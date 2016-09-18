/**
 * Codemod for transforming AVA tests into Jest.
 */

import detectQuoteStyle from '../utils/quote-style';
import { removeRequireAndImport } from '../utils/imports';
import detectIncompatiblePackages from '../utils/incompatible-packages';
import { PROP_WITH_SECONDS_ARGS } from '../utils/consts';
import logger from '../utils/logger';

const SPECIAL_THROWS_CASE = '(special throws case)';
const SPECIAL_BOOL = '(special bool case)';

const avaToJestExpect = {
    truthy: 'toBeTruthy',
    falsy: 'toBeFalsy',
    true: SPECIAL_BOOL,
    false: SPECIAL_BOOL,
    is: 'toBe',
    not: 'not.toBe',
    deepEqual: 'toEqual',
    notDeepEqual: 'not.toEqual',
    throws: SPECIAL_THROWS_CASE,
    notThrows: SPECIAL_THROWS_CASE,
    regex: 'toMatch',
    notRegex: 'not.toMatch',
};

const unsupportedTProperties = new Set([
    'fail',
    'pass',
    'ifError',
    'skip',
    'plan',
]);

export default function avaToJest(fileInfo, api) {
    const j = api.jscodeshift;
    const ast = j(fileInfo.source);

    const testFunctionName = removeRequireAndImport(j, ast, 'ava');

    if (!testFunctionName) {
        // No require/import were found
        return fileInfo.source;
    }

    const logWarning = (msg, node) => logger(fileInfo, msg, node);

    const transforms = [
        function detectUnsupportedNaming() {
            // Currently we only support "t" as the test argument name
            const validateTestArgument = p => {
                const lastArg = p.value.arguments[p.value.arguments.length - 1];
                if (lastArg && lastArg.params && lastArg.params[0]) {
                    const lastArgName = lastArg.params[0].name;
                    if (lastArgName !== 't') {
                        logWarning(`argument to test function should be named "t" not "${lastArgName}"`, p);
                    }
                }
            };

            ast.find(j.CallExpression, {
                callee: {
                    object: { name: testFunctionName },
                },
            })
            .forEach(validateTestArgument);

            ast.find(j.CallExpression, {
                callee: { name: testFunctionName },
            })
            .forEach(validateTestArgument);
        },

        function detectUnsupportedFeatures() {
            ast.find(j.CallExpression, {
                callee: {
                    object: { name: 't' },
                    property: ({ name }) => unsupportedTProperties.has(name),
                },
            })
            .forEach(p => {
                const propertyName = p.value.callee.property.name;
                logWarning(`"${propertyName}" is currently not supported`, p);
            });
        },

        function updateAssertions() {
            ast.find(j.CallExpression, {
                callee: {
                    object: { name: 't' },
                    property: ({ name }) => Object.keys(avaToJestExpect).indexOf(name) >= 0,
                },
            })
            .forEach(p => {
                const args = p.node.arguments;
                const oldPropertyName = p.value.callee.property.name;
                const newPropertyName = avaToJestExpect[p.node.callee.property.name];

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

                j(p).replaceWith(newExpression);
            });
        },

        function rewriteTestCallExpression() {
            ast.find(j.CallExpression, {
                callee: { name: testFunctionName },
            }).forEach(p => {
                p.node.callee.name = 'test';  // FIXME: what name do people want?

                // Removes t parameter: "t => {}" and "function(t)"
                const lastArg = p.node.arguments[p.node.arguments.length - 1];
                if (lastArg.type === 'ArrowFunctionExpression') {
                    const arrowFunction = j.arrowFunctionExpression(
                        [j.identifier('()')],
                        lastArg.body,
                        false
                     );
                    p.node.arguments[p.node.arguments.length - 1] = arrowFunction;
                } else if (lastArg.type === 'FunctionExpression') {
                    lastArg.params = [j.identifier('')];
                }
            });
        },

        () => detectIncompatiblePackages(fileInfo, j, ast),
    ];

    transforms.forEach(t => t());

    // As Recast is not preserving original quoting, we try to detect it,
    // and default to something sane.
    const quote = detectQuoteStyle(j, ast) || 'single';
    return ast.toSource({ quote });
}
