import finale from '../utils/finale';
import { removeDefaultImport, removeRequireAndImport } from '../utils/imports';
import logger from '../utils/logger';

const getAssertionExpression = (chaiAssertExpression, assertionName) => ({
    type: 'CallExpression',
    callee: {
        type: 'MemberExpression',
        object: chaiAssertExpression,
        property: {
            type: 'Identifier',
            name: assertionName,
        },
    },
});

const assertToExpectMapping = [
    {
        assert: 'ok',
        expect: 'toBeTruthy',
        ignoreExpectedValue: true,
    },
    {
        assert: 'notOk',
        expect: 'toBeFalsy',
        ignoreExpectedValue: true,
    },
    {
        assert: 'isOk',
        expect: 'toBeTruthy',
        ignoreExpectedValue: true,
    },
    {
        assert: 'isNotOk',
        expect: 'toBeFalsy',
        ignoreExpectedValue: true,
    },
    {
        assert: 'equal',
        expect: 'toEqual',
        includeNegative: 'notEqual',
    },
    {
        assert: 'strictEqual',
        expect: 'toBe',
        includeNegative: 'notStrictEqual',
    },
    {
        assert: 'deepEqual',
        expect: 'toEqual',
        includeNegative: 'notDeepEqual',
    },
    {
        assert: 'isAbove',
        expect: 'toBeGreaterThan',
    },
    {
        assert: 'isAtLeast',
        expect: 'toBeGreaterThanOrEqual',
    },
    {
        assert: 'isBelow',
        expect: 'toBeLessThan',
    },
    {
        assert: 'isAtMost',
        expect: 'toBeLessThanOrEqual',
    },
    {
        assert: 'isTrue',
        expect: 'toBe',
        expectedOverride: true,
        includeNegative: 'isNotTrue',
    },
    {
        assert: 'isFalse',
        expect: 'toBe',
        expectedOverride: false,
        includeNegative: 'isNotFalse',
    },
    {
        assert: 'isNull',
        expect: 'toBeNull',
        ignoreExpectedValue: true,
        includeNegative: 'isNotNull',
    },
    {
        assert: 'isNaN',
        expect: 'toBe',
        ignoreExpectedValue: true,
        expectedOverride: 'NaN',
        includeNegative: 'isNotNaN',
    },
    {
        assert: 'isDefined',
        expect: 'toBeDefined',
        ignoreExpectedValue: true,
        includeNegative: 'isUndefined',
    },
    {
        assert: 'instanceOf',
        expect: 'toBeInstanceOf',
        includeNegative: 'notInstanceOf',
    },
    {
        assert: 'include',
        expect: 'toContain',
        includeNegative: 'notInclude',
    },
    {
        assert: 'match',
        expect: 'toMatch',
        includeNegative: 'notMatch',
    },
    {
        assert: 'throws',
        expect: 'toThrow',
        ignoreExpectedValue: true,
        includeNegative: 'doesNotThrow',
    },
    {
        assert: 'sameMembers',
        expect: 'toEqual',
    },
    {
        assert: 'sameDeepMembers',
        expect: 'toEqual',
    },
    {
        assert: 'nestedProperty',
        expect: 'toHaveProperty',
        includeNegative: 'notNestedProperty',
    },
];

const objectChecks = [
    'isExtensible',
    'isNotExtensible',
    'isSealed',
    'isNotSealed',
    'isFrozen',
    'isNotFrozen',
];

/**
 * Type checking
 */
const chaiAssertTypeofs = [
    { assert: 'isFunction', type: 'function' },
    { assert: 'isObject', type: 'object' },
    { assert: 'isString', type: 'string' },
    { assert: 'isNumber', type: 'number' },
    { assert: 'isBoolean', type: 'boolean' },
];

const getArguments = (path, ignoreExpectedValue, expectedOverride) => {
    const [actual, originalExpectation] = path.value.arguments;
    const expectation = !ignoreExpectedValue
        ? expectedOverride || originalExpectation
        : undefined;
    return expectation ? { actual, expectation } : { actual };
};

const unsupportedAssertions = [
    'operator',
    'changes',
    'doesNotChange',
    'increases',
    'doesNotIncrease',
    'decreases',
    'doesNotDecrease',
];

export default function transformer(fileInfo, api, options) {
    const j = api.jscodeshift;
    const ast = j(fileInfo.source);

    let chaiAssertExpression;

    let assertLocalName = removeRequireAndImport(j, ast, 'chai', 'assert');
    const defaultImportLocalName = removeDefaultImport(j, ast, 'chai');
    if (assertLocalName) {
        chaiAssertExpression = {
            type: 'Identifier',
            name: assertLocalName,
        };
    } else if (defaultImportLocalName) {
        chaiAssertExpression = {
            type: 'MemberExpression',
            object: {
                type: 'Identifier',
                name: defaultImportLocalName,
            },
            property: {
                type: 'Identifier',
                name: 'assert',
            },
        };
    }

    if (!chaiAssertExpression) {
        if (!options.skipImportDetection) {
            // No Chai require/import were found
            return fileInfo.source;
        }
        assertLocalName = 'assert';
        chaiAssertExpression = {
            type: 'Identifier',
            name: 'assert',
        };
    }

    const logWarning = (msg: string, path) => logger(fileInfo, msg, path);

    const makeExpectation = (identifier: string, actual: any, expectation: any = []) =>
        j.callExpression(
            j.memberExpression(
                j.callExpression(j.identifier('expect'), [actual]),
                j.identifier(identifier)
            ),
            Array.isArray(expectation) ? expectation : [expectation]
        );

    const makeExpectationNamedArguments = ({
        identifier,
        actual,
        expectation = [],
    }: {
        identifier: string;
        actual: any;
        expectation?: any;
    }) => makeExpectation(identifier, actual, expectation);

    const makeNegativeExpectation = (
        identifier: string,
        actual: any,
        expectation: any = []
    ) =>
        j.callExpression(
            j.memberExpression(
                j.memberExpression(
                    j.callExpression(j.identifier('expect'), [actual]),
                    j.identifier('not')
                ),
                j.identifier(identifier)
            ),
            Array.isArray(expectation) ? expectation : [expectation]
        );

    const makeNegativeExpectationNamedArguments = ({
        identifier,
        actual,
        expectation = [],
    }: {
        identifier: string;
        actual: any;
        expectation?: any;
    }) => makeNegativeExpectation(identifier, actual, expectation);

    assertToExpectMapping.forEach(
        ({ assert, expect, ignoreExpectedValue, includeNegative, expectedOverride }) => {
            let override;
            if (typeof expectedOverride !== 'undefined') {
                override =
                    typeof expectedOverride === 'boolean'
                        ? j.literal(expectedOverride)
                        : j.identifier(expectedOverride);
            }

            ast.find(
                j.CallExpression,
                getAssertionExpression(chaiAssertExpression, assert)
            ).replaceWith(path =>
                makeExpectationNamedArguments({
                    identifier: expect,
                    ...getArguments(path, ignoreExpectedValue, override),
                })
            );

            if (includeNegative) {
                ast.find(
                    j.CallExpression,
                    getAssertionExpression(chaiAssertExpression, includeNegative)
                ).replaceWith(path =>
                    makeNegativeExpectationNamedArguments({
                        identifier: expect,
                        ...getArguments(path, ignoreExpectedValue, override),
                    })
                );
            }
        }
    );

    unsupportedAssertions.forEach(assertion => {
        ast.find(
            j.CallExpression,
            getAssertionExpression(chaiAssertExpression, assertion)
        ).forEach(path => {
            logWarning(`Unsupported Chai Assertion "${assertion}".`, path);
        });
    });

    ['approximately', 'closeTo'].forEach(assertion => {
        ast.find(
            j.CallExpression,
            getAssertionExpression(chaiAssertExpression, assertion)
        ).replaceWith(path =>
            makeExpectation(
                'toBeLessThanOrEqual',
                j.callExpression(
                    j.memberExpression(j.identifier('Math'), j.identifier('abs')),
                    [
                        j.binaryExpression(
                            '-',
                            path.value.arguments[0] as any,
                            path.value.arguments[1]
                        ),
                    ]
                ),
                [path.value.arguments[2]]
            )
        );
    });

    // assert.nestedPropertyVal -> expect(obj).toHaveProperty()
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'nestedPropertyVal')
    ).replaceWith(path =>
        makeExpectation('toHaveProperty', path.value.arguments[0], [
            path.value.arguments[1],
            path.value.arguments[2],
        ])
    );

    // assert.notNestedPropertyVal -> expect(obj).not.toHaveProperty()
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'notNestedPropertyVal')
    ).replaceWith(path =>
        makeNegativeExpectation('toHaveProperty', path.value.arguments[0], [
            path.value.arguments[1],
            path.value.arguments[2],
        ])
    );

    // assert.fail -> expect(false).toBeTruthy()
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'fail')
    ).replaceWith(path => makeExpectation('toBe', j.literal(false), j.literal(true)));

    // assert.propertyVal -> expect(*.[prop]).toBe()
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'propertyVal')
    ).replaceWith(path => {
        const [obj, prop, value] = path.value.arguments;
        return makeExpectation('toBe', j.memberExpression(obj, prop), value);
    });

    // assert.propertyNotVal -> expect(*.[prop]).not.toBe()
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'propertyNotVal')
    ).replaceWith(path => {
        const [obj, prop, value] = path.value.arguments;
        return makeNegativeExpectation('toBe', j.memberExpression(obj, prop), value);
    });

    // assert.notPropertyVal -> expect(*.[prop]).not.toBe()
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'notPropertyVal')
    ).replaceWith(path => {
        const [obj, prop, value] = path.value.arguments;
        return makeNegativeExpectation('toBe', j.memberExpression(obj, prop), value);
    });

    // assert.deepPropertyVal -> expect(*).toHaveProperty(keyPath, ?value)
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'deepPropertyVal')
    ).replaceWith(path => {
        const [obj, prop, value] = path.value.arguments;
        return makeExpectation('toHaveProperty', obj, [prop, value]);
    });

    // assert.deepPropertyNotVal -> expect(*).not.toHaveProperty(keyPath, ?value)
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'deepPropertyNotVal')
    ).replaceWith(path => {
        const [obj, prop, value] = path.value.arguments;
        return makeNegativeExpectation('toHaveProperty', obj, [prop, value]);
    });

    // assert.notDeepPropertyVal -> expect(*).not.toHaveProperty(keyPath, ?value)
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'notDeepPropertyVal')
    ).replaceWith(path => {
        const [obj, prop, value] = path.value.arguments;
        return makeNegativeExpectation('toHaveProperty', obj, [prop, value]);
    });

    // assert.deepProperty -> expect(*).toHaveProperty(keyPath)
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'deepProperty')
    ).replaceWith(path => {
        const [obj, prop] = path.value.arguments;
        return makeExpectation('toHaveProperty', obj, prop);
    });

    // assert.notDeepProperty -> expect(*).not.toHaveProperty(keyPath)
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'notDeepProperty')
    ).replaceWith(path => {
        const [obj, prop] = path.value.arguments;
        return makeNegativeExpectation('toHaveProperty', obj, prop);
    });

    // assert.property -> expect(prop in obj).toBeTruthy()
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'property')
    ).replaceWith(path =>
        makeExpectation(
            'toBeTruthy',
            j.binaryExpression('in', path.value.arguments[1], path.value.arguments[0])
        )
    );

    // assert.notProperty -> expect(prop in obj).toBeFalsy()
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'notProperty')
    ).replaceWith(path =>
        makeExpectation(
            'toBeFalsy',
            j.binaryExpression('in', path.value.arguments[1], path.value.arguments[0])
        )
    );

    // assert.ifError -> expect(*).toBeFalsy()
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'ifError')
    ).replaceWith(path => makeExpectation('toBeFalsy', path.value.arguments[0]));

    // assert.includeMembers -> expect([]).toEqual(expect.arrayContaining([]))
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'includeMembers')
    ).replaceWith(path => {
        return makeExpectation(
            'toEqual',
            path.value.arguments[0],
            j.callExpression(
                j.memberExpression(
                    j.identifier('expect'),
                    j.identifier('arrayContaining')
                ),
                [path.value.arguments[1]]
            )
        );
    });

    // assert.notIncludeMembers -> expect([]).not.toEqual(expect.arrayContaining([]))
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'notIncludeMembers')
    ).replaceWith(path => {
        return makeNegativeExpectation(
            'toEqual',
            path.value.arguments[0],
            j.callExpression(
                j.memberExpression(
                    j.identifier('expect'),
                    j.identifier('arrayContaining')
                ),
                [path.value.arguments[1]]
            )
        );
    });

    // assert.includeDeepMembers -> expect([]).toEqual(expect.arrayContaining([]))
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'includeDeepMembers')
    ).replaceWith(path => {
        return makeExpectation(
            'toEqual',
            path.value.arguments[0],
            j.callExpression(
                j.memberExpression(
                    j.identifier('expect'),
                    j.identifier('arrayContaining')
                ),
                [path.value.arguments[1]]
            )
        );
    });

    // assert.notIncludeDeepMembers -> expect([]).not.toEqual(expect.arrayContaining([]))
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'notIncludeDeepMembers')
    ).replaceWith(path => {
        return makeNegativeExpectation(
            'toEqual',
            path.value.arguments[0],
            j.callExpression(
                j.memberExpression(
                    j.identifier('expect'),
                    j.identifier('arrayContaining')
                ),
                [path.value.arguments[1]]
            )
        );
    });

    // assert.isArray -> expect(Array.isArray).toBe(true)
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'isArray')
    ).replaceWith(path =>
        makeExpectation(
            'toBe',
            j.callExpression(
                j.memberExpression(j.identifier('Array'), j.identifier('isArray')),
                [path.value.arguments[0]]
            ),
            j.literal(true)
        )
    );

    // assert.isArray -> expect(Array.isArray).toBe(false)
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'isNotArray')
    ).replaceWith(path =>
        makeNegativeExpectation(
            'toBe',
            j.callExpression(
                j.memberExpression(j.identifier('Array'), j.identifier('isArray')),
                [path.value.arguments[0]]
            ),
            j.literal(true)
        )
    );

    // assert.typeOf(foo, Bar) -> expect(typeof foo).toBe(Bar)
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'typeOf')
    ).replaceWith(path =>
        makeExpectation(
            'toBe',
            j.unaryExpression('typeof', path.value.arguments[0]),
            path.value.arguments[1]
        )
    );

    // assert.notTypeOf(foo, Bar) -> expect(typeof foo).not.toBe(Bar)
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'notTypeOf')
    ).replaceWith(path =>
        makeNegativeExpectation(
            'toBe',
            j.unaryExpression('typeof', path.value.arguments[0]),
            path.value.arguments[1]
        )
    );

    chaiAssertTypeofs.forEach(({ assert, type }) => {
        ast.find(
            j.CallExpression,
            getAssertionExpression(chaiAssertExpression, assert)
        ).replaceWith(path =>
            makeExpectation(
                'toBe',
                j.unaryExpression('typeof', path.value.arguments[0]),
                j.literal(type)
            )
        );

        ast.find(
            j.CallExpression,
            getAssertionExpression(chaiAssertExpression, assert.replace(/^is/, 'isNot'))
        ).replaceWith(path =>
            makeNegativeExpectation(
                'toBe',
                j.unaryExpression('typeof', path.value.arguments[0] as any),
                j.literal(type)
            )
        );
    });

    // assert.lengthOf -> expect(*.length).toBe()
    ast.find(
        j.CallExpression,
        getAssertionExpression(chaiAssertExpression, 'lengthOf')
    ).replaceWith(path =>
        makeExpectation(
            'toBe',
            j.memberExpression(path.value.arguments[0] as any, j.identifier('length')),
            path.value.arguments[1]
        )
    );

    // Object-specific boolean checks
    objectChecks.forEach(check => {
        const isNegative = check.indexOf('isNot') === 0;
        const expectation = check.replace('isNot', 'is');
        ast.find(
            j.CallExpression,
            getAssertionExpression(chaiAssertExpression, check)
        ).replaceWith(path =>
            (isNegative ? makeNegativeExpectation : makeExpectation)(
                'toBe',
                j.callExpression(
                    j.memberExpression(j.identifier('Object'), j.identifier(expectation)),
                    [path.value.arguments[0]]
                ),
                j.literal(true)
            )
        );
    });

    // assert -> expect().toBeTruthy()
    ast.find(j.CallExpression, {
        callee: { type: 'Identifier', name: assertLocalName },
    }).replaceWith(path => makeExpectation('toBeTruthy', path.value.arguments[0]));

    return finale(fileInfo, j, ast, options);
}
