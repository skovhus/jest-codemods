/**
 * Codemod for transforming AVA tests into Jest.
 */

import detectQuoteStyle from '../utils/quote-style';
import { removeRequireAndImport } from '../utils/imports';
import detectIncompatiblePackages from '../utils/incompatible-packages';
import { PROP_WITH_SECONDS_ARGS } from '../utils/consts';
import {
    detectUnsupportedNaming, rewriteAssertionsAndTestArgument,
} from '../utils/tape-ava-helpers';
import {
    getIdentifierFromExpression, getMemberExpressionElements,
} from '../utils/recast-helpers';
import logger from '../utils/logger';

const SPECIAL_THROWS_CASE = '(special throws case)';
const SPECIAL_BOOL = '(special bool case)';

const tPropertiesMap = {
    ok: 'toBeTruthy',
    truthy: 'toBeTruthy',
    falsy: 'toBeFalsy',
    notOk: 'toBeFalsy',
    true: SPECIAL_BOOL,
    false: SPECIAL_BOOL,
    is: 'toBe',
    not: 'not.toBe',
    same: 'toEqual',
    deepEqual: 'toEqual',
    notSame: 'not.toEqual',
    notDeepEqual: 'not.toEqual',
    throws: SPECIAL_THROWS_CASE,
    notThrows: SPECIAL_THROWS_CASE,
    regex: 'toMatch',
    notRegex: 'not.toMatch',
    ifError: 'toBeFalsy',
    error: 'toBeFalsy',
};

const tPropertiesNotMapped = new Set([
    'end',
    'fail',
    'pass',
]);

const avaToJestMethods = {
    before: 'before',
    after: 'after',
    beforeEach: 'beforeEach',
    afterEach: 'afterEach',

    skip: 'xit',
    only: 'fit',
};

export default function avaToJest(fileInfo, api) {
    const j = api.jscodeshift;
    const ast = j(fileInfo.source);

    const testFunctionName = removeRequireAndImport(j, ast, 'ava');

    if (!testFunctionName) {
        // No AVA require/import were found
        return fileInfo.source;
    }

    const logWarning = (msg, node) => logger(fileInfo, msg, node);

    const transforms = [
        () => detectUnsupportedNaming(fileInfo, j, ast, testFunctionName),

        function updateAssertions() {
            ast.find(j.CallExpression, {
                callee: {
                    object: { name: 't' },
                    property: ({ name }) => !tPropertiesNotMapped.has(name),
                },
            })
            .forEach(p => {
                const args = p.node.arguments;
                const oldPropertyName = p.value.callee.property.name;
                const newPropertyName = tPropertiesMap[oldPropertyName];

                if (typeof newPropertyName === 'undefined') {
                    logWarning(`"t.${oldPropertyName}" is currently not supported`, p);
                    return null;
                }

                let newCondition;
                if (newPropertyName === SPECIAL_BOOL) {
                    newCondition = j.callExpression(
                        j.identifier('toBe'),
                        [j.identifier(oldPropertyName)]
                    );
                } else if (newPropertyName === SPECIAL_THROWS_CASE) {
                    if (args.length === 1) {
                        newCondition = j.callExpression(
                            j.identifier(oldPropertyName === 'throws' ? 'toThrow' : 'not.toThrow'),
                            []
                        );
                    } else {
                        newCondition = j.callExpression(
                            j.identifier('toThrowError'),
                            [args[1]]
                        );
                    }
                } else {
                    const hasSecondArgument = PROP_WITH_SECONDS_ARGS.indexOf(newPropertyName) >= 0;
                    const conditionArgs = hasSecondArgument ? [args[1]] : [];
                    newCondition = j.callExpression(
                        j.identifier(newPropertyName),
                        conditionArgs
                    );
                }

                const newExpression = j.memberExpression(
                    j.callExpression(
                        j.identifier('expect'),
                        [args[0]]
                    ),
                    newCondition
                );

                return j(p).replaceWith(newExpression);
            });
        },

        function rewriteTestCallExpression() {
            // Can either be simple CallExpression like test()
            // Or MemberExpression like test.after.skip()

            ast.find(j.CallExpression, {
                callee: { name: testFunctionName },
            }).forEach(p => {
                p.node.callee.name = 'it';
                rewriteAssertionsAndTestArgument(j, p);
            });

            function mapPathToJestMethod(p) {
                let jestMethod = 'it';

                // List like ['test', 'serial', 'cb']
                const avaMethods = getMemberExpressionElements(
                    p.node.callee
                )
                .filter(
                    e => e !== 'serial' &&
                    e !== testFunctionName &&
                    e !== 'cb'
                );

                if (avaMethods.length === 1) {
                    const avaMethod = avaMethods[0];
                    if (avaMethod in avaToJestMethods) {
                        jestMethod = avaToJestMethods[avaMethod];
                    } else {
                        jestMethod = avaMethod;
                        logWarning(`Unknown AVA method "${avaMethod}"`, p);
                    }
                } else if (avaMethods.length > 0) {
                    logWarning('Skipping setup/teardown hooks is currently not supported', p);
                }

                return jestMethod;
            }

            ast.find(j.CallExpression, {
                callee: {
                    type: 'MemberExpression',
                },
            })
            .filter(p => {
                const identifier = getIdentifierFromExpression(p.node.callee);
                if (identifier === null) {
                    return null;
                }
                if (identifier.name === testFunctionName) {
                    return p;
                }
                return null;
            })
            .forEach(p => {
                rewriteAssertionsAndTestArgument(j, p);
            })
            .replaceWith(p =>
                j.callExpression(
                    j.identifier(mapPathToJestMethod(p)),
                    p.node.arguments
                )
            );
        },

        () => detectIncompatiblePackages(fileInfo, j, ast),
    ];

    transforms.forEach(t => t());

    // As Recast is not preserving original quoting, we try to detect it,
    // and default to something sane.
    const quote = detectQuoteStyle(j, ast) || 'single';
    return ast.toSource({ quote });
}
