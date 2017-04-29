import logger from '../utils/logger';
import { removeRequireAndImport } from '../utils/imports';
import finale from '../utils/finale';

const getAssertionExpression = identifier => ({
    type: 'CallExpression',
    callee: {
        type: 'MemberExpression',
        object: {
            type: 'Identifier',
            name: 'assert',
        },
        property: {
            type: 'Identifier',
            name: identifier,
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
    return expectation ? [actual, expectation] : [actual];
};

const unsupportedAssertions = [
    'deepProperty',
    'notDeepProperty',
    'deepPropertyVal',
    'deepPropertyNotVal',
    'operator',
    'includeMembers',
    'includeDeepMembers',
    'changes',
    'doesNotChange',
    'increases',
    'doesNotIncrease',
    'decreases',
    'doesNotDecrease',
    'ifError',
];

export default function transformer(fileInfo, api, options) {
    const j = api.jscodeshift;
    const ast = j(fileInfo.source);

    const testFunctionName = removeRequireAndImport(j, ast, 'chai', 'assert');

    if (!testFunctionName) {
        // No Chai require/import were found
        return fileInfo.source;
    }

    const logWarning = (msg, path) => logger(fileInfo, msg, path);

    const makeExpectation = (identifier, actual, expectation = []) =>
        j.callExpression(
            j.memberExpression(
                j.callExpression(j.identifier('expect'), [actual]),
                j.identifier(identifier)
            ),
            Array.isArray(expectation) ? expectation : [expectation]
        );

    const makeNegativeExpectation = (identifier, actual, expectation = []) =>
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

    assertToExpectMapping.forEach(({
        assert,
        expect,
        ignoreExpectedValue,
        includeNegative,
        expectedOverride,
    }) => {
        let override;
        if (typeof expectedOverride !== 'undefined') {
            override = typeof expectedOverride === 'boolean'
                ? j.literal(expectedOverride)
                : j.identifier(expectedOverride);
        }

        ast
            .find(j.CallExpression, getAssertionExpression(assert))
            .replaceWith(path =>
                makeExpectation(
                    expect,
                    ...getArguments(path, ignoreExpectedValue, override)
                )
            );

        if (includeNegative) {
            ast
                .find(j.CallExpression, getAssertionExpression(includeNegative))
                .replaceWith(path =>
                    makeNegativeExpectation(
                        expect,
                        ...getArguments(path, ignoreExpectedValue, override)
                    )
                );
        }
    });

    unsupportedAssertions.forEach(assertion => {
        ast.find(j.CallExpression, getAssertionExpression(assertion)).forEach(path => {
            logWarning(`Unsupported Chai Assertion "${assertion}".`, path);
        });
    });

    ['approximately', 'closeTo'].forEach(assertion => {
        ast
            .find(j.CallExpression, getAssertionExpression(assertion))
            .replaceWith(path =>
                makeExpectation(
                    'toBeCloseTo',
                    path.value.arguments[0],
                    path.value.arguments.slice(1, 3)
                )
            );
    });

    // assert.fail -> expect(false).toBeTruthy()
    ast
        .find(j.CallExpression, getAssertionExpression('fail'))
        .replaceWith(path => makeExpectation('toBe', j.literal(false), j.literal(true)));

    // assert.propertyVal -> expect(*.[prop]).toBe()
    ast
        .find(j.CallExpression, getAssertionExpression('propertyVal'))
        .replaceWith(path => {
            const [obj, prop, value] = path.value.arguments;
            return makeExpectation('toBe', j.memberExpression(obj, prop), value);
        });

    // assert.propertyNotVal -> expect(*.[prop]).not.toBe()
    ast
        .find(j.CallExpression, getAssertionExpression('propertyNotVal'))
        .replaceWith(path => {
            const [obj, prop, value] = path.value.arguments;
            return makeNegativeExpectation('toBe', j.memberExpression(obj, prop), value);
        });

    // assert.property -> expect(prop in obj).toBeTruthy()
    ast
        .find(j.CallExpression, getAssertionExpression('property'))
        .replaceWith(path =>
            makeExpectation(
                'toBeTruthy',
                j.binaryExpression('in', path.value.arguments[1], path.value.arguments[0])
            )
        );

    // assert.notProperty -> expect(prop in obj).toBeFalsy()
    ast
        .find(j.CallExpression, getAssertionExpression('notProperty'))
        .replaceWith(path =>
            makeExpectation(
                'toBeFalsy',
                j.binaryExpression('in', path.value.arguments[1], path.value.arguments[0])
            )
        );

    // assert.isArray -> expect(Array.isArray).toBe(true)
    ast
        .find(j.CallExpression, getAssertionExpression('isArray'))
        .replaceWith(path =>
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
    ast
        .find(j.CallExpression, getAssertionExpression('isNotArray'))
        .replaceWith(path =>
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
    ast
        .find(j.CallExpression, getAssertionExpression('typeOf'))
        .replaceWith(path =>
            makeExpectation(
                'toBe',
                j.unaryExpression('typeof', path.value.arguments[0]),
                path.value.arguments[1]
            )
        );

    // assert.notTypeOf(foo, Bar) -> expect(typeof foo).not.toBe(Bar)
    ast
        .find(j.CallExpression, getAssertionExpression('notTypeOf'))
        .replaceWith(path =>
            makeNegativeExpectation(
                'toBe',
                j.unaryExpression('typeof', path.value.arguments[0]),
                path.value.arguments[1]
            )
        );

    chaiAssertTypeofs.forEach(({ assert, type }) => {
        ast
            .find(j.CallExpression, getAssertionExpression(assert))
            .replaceWith(path =>
                makeExpectation(
                    'toBe',
                    j.unaryExpression('typeof', path.value.arguments[0]),
                    j.literal(type)
                )
            );

        ast
            .find(
                j.CallExpression,
                getAssertionExpression(assert.replace(/^is/, 'isNot'))
            )
            .replaceWith(path =>
                makeNegativeExpectation(
                    'toBe',
                    j.unaryExpression('typeof', path.value.arguments[0]),
                    j.literal(type)
                )
            );
    });

    // assert.lengthOf -> expect(*.length).toBe()
    ast
        .find(j.CallExpression, getAssertionExpression('lengthOf'))
        .replaceWith(path =>
            makeExpectation(
                'toBe',
                j.memberExpression(path.value.arguments[0], j.identifier('length')),
                path.value.arguments[1]
            )
        );

    // Object-specific boolean checks
    objectChecks.forEach(check => {
        const isNegative = check.indexOf('isNot') === 0;
        const expectation = check.replace('isNot', 'is');
        ast
            .find(j.CallExpression, getAssertionExpression(check))
            .replaceWith(path =>
                (isNegative ? makeNegativeExpectation : makeExpectation)(
                    'toBe',
                    j.callExpression(
                        j.memberExpression(
                            j.identifier('Object'),
                            j.identifier(expectation)
                        ),
                        [path.value.arguments[0]]
                    ),
                    j.literal(true)
                )
            );
    });

    // assert -> expect().toBeTruthy()
    ast
        .find(j.CallExpression, {
            callee: { type: 'Identifier', name: 'assert' },
        })
        .replaceWith(path => makeExpectation('toBeTruthy', path.value.arguments[0]));

    return finale(fileInfo, j, ast, options);
}
