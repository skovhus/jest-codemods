/**
 * Codemod for transforming Tape tests into Jest.
 */
import detectQuoteStyle from '../utils/quote-style';
import { removeRequireAndImport } from '../utils/imports';
import detectIncompatiblePackages from '../utils/incompatible-packages';
import { PROP_WITH_SECONDS_ARGS } from '../utils/consts';
import {
    detectUnsupportedNaming, rewriteAssertionsAndTestArgument, rewriteDestructuredTArgument,
} from '../utils/tape-ava-helpers';
import logger from '../utils/logger';
import proxyquireTransformer from '../utils/proxyquire';

const SPECIAL_THROWS_CASE = '(special throws case)';
const SPECIAL_ASSERTION_CASE = '(special assertion case)';

const tPropertiesMap = {
    ok: 'toBeTruthy',
    true: 'toBeTruthy',
    assert: 'toBeTruthy',

    notOk: 'toBeFalsy',
    false: 'toBeFalsy',
    notok: 'toBeFalsy',

    error: 'toBeFalsy',
    ifError: 'toBeFalsy',
    ifErr: 'toBeFalsy',
    iferror: 'toBeFalsy',

    equal: 'toBe',
    equals: 'toBe',
    isEqual: 'toBe',
    is: 'toBe',
    strictEqual: 'toBe',
    strictEquals: 'toBe',

    notEqual: 'not.toBe',
    notStrictEqual: 'not.toBe',
    notStrictEquals: 'not.toBe',
    isNotEqual: 'not.toBe',
    isNot: 'not.toBe',
    not: 'not.toBe',
    doesNotEqual: 'not.toBe',
    isInequal: 'not.toBe',

    deepEqual: 'toEqual',
    isEquivalent: 'toEqual',
    same: 'toEqual',

    notDeepEqual: 'not.toEqual',
    notEquivalent: 'not.toEqual',
    notDeeply: 'not.toEqual',
    notSame: 'not.toEqual',
    isNotDeepEqual: 'not.toEqual',
    isNotEquivalent: 'not.toEqual',
    isInequivalent: 'not.toEqual',

    throws: SPECIAL_THROWS_CASE,
    doesNotThrow: SPECIAL_THROWS_CASE,
    plan: SPECIAL_ASSERTION_CASE,
};

const tPropertiesNotMapped = new Set([
    'pass',
    'fail',
    'end',
    'comment',
]);

const tPropertiesUnsupported = new Set([
    'timeoutAfter',

    // toEqual is more strict but might be used in some cases:
    'deepLooseEqual',
    'looseEqual',
    'looseEquals',
    'notDeepLooseEqual',
    'notLooseEqual',
    'notLooseEquals',

    'skip',
]);

const unsupportedTestFunctionProperties = new Set([
    'createStream',
    'onFinish',
]);

export default function tapeToJest(fileInfo, api) {
    const j = api.jscodeshift;
    const ast = j(fileInfo.source);

    const testFunctionName = removeRequireAndImport(j, ast, 'tape');

    if (!testFunctionName) {
        // No Tape require/import were found
        return fileInfo.source;
    }

    const logWarning = (msg, node) => logger(fileInfo, msg, node);

    const transforms = [
        () => rewriteDestructuredTArgument(fileInfo, j, ast, testFunctionName),

        () => detectUnsupportedNaming(fileInfo, j, ast, testFunctionName),

        function detectUnsupportedFeatures() {
            ast.find(j.CallExpression, {
                callee: {
                    object: { name: 't' },
                    property: ({ name }) => tPropertiesUnsupported.has(name),
                },
            })
            .forEach(p => {
                const propertyName = p.value.callee.property.name;
                if (propertyName.toLowerCase().indexOf('looseequal') >= 0) {
                    logWarning(`"t.${propertyName}" is currently not supported. Try the stricter "toEqual" or "not.toEqual"`, p);
                } else {
                    logWarning(`"t.${propertyName}" is currently not supported`, p);
                }
            });

            ast.find(j.CallExpression, {
                callee: {
                    object: { name: testFunctionName },
                    property: ({ name }) => unsupportedTestFunctionProperties.has(name),
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
                    property: ({ name }) => !tPropertiesUnsupported.has(name) && !tPropertiesNotMapped.has(name),
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
                if (newPropertyName === SPECIAL_THROWS_CASE) {
                    // The semantics of t.throws(fn, expected, msg) in Tape:
                    // If `expected` is a string, it is set to msg, else exception reg exp
                    const secondArgString = args.length === 2 && args[1].type === 'Literal' && typeof args[1].value === 'string';
                    const noErrorType = args.length === 1 || secondArgString;
                    if (noErrorType) {
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
                } else if (newPropertyName === SPECIAL_ASSERTION_CASE) {
                    const condition = (
                        j.memberExpression(
                            j.identifier('expect'),
                            j.callExpression(j.identifier('assertions'), [args[0]])
                        )
                    );
                    return j(p).replaceWith(condition);
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

        function updateTapeComments() {
            ast.find(j.CallExpression, {
                callee: {
                    object: { name: 't' },
                    property: { name: 'comment' },
                },
            })
            .forEach(p => {
                p.node.callee = 'console.log';
            });
        },

        function rewriteTestCallExpression() {
            ast.find(j.CallExpression, {
                callee: { name: testFunctionName },
            }).forEach(p => {
                // Convert Tape option parameters, test([name], [opts], cb)
                p.value.arguments.forEach(a => {
                    if (a.type === 'ObjectExpression') {
                        a.properties.forEach(tapeOption => {
                            const tapeOptionKey = tapeOption.key.name;
                            const tapeOptionValue = tapeOption.value.value;
                            if (tapeOptionKey === 'skip' && tapeOptionValue === true) {
                                p.value.callee.name = 'xit';
                            }

                            if (tapeOptionKey === 'timeout') {
                                logWarning('"timeout" option is currently not supported', p);
                            }
                        });

                        p.value.arguments = p.value.arguments.filter(pa => pa.type !== 'ObjectExpression');
                    }
                });

                if (p.node.callee.name !== 'xit') {
                    p.node.callee.name = 'it';
                }

                rewriteAssertionsAndTestArgument(j, p);
            });
        },

        () => detectIncompatiblePackages(fileInfo, j, ast),
        () => proxyquireTransformer(fileInfo, j, ast),
    ];

    transforms.forEach(t => t());

    // As Recast is not preserving original quoting, we try to detect it,
    // and default to something sane.
    const quote = detectQuoteStyle(j, ast) || 'single';
    return ast.toSource({ quote });
}
