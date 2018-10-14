/**
 * Codemod for transforming Jasmine `this` context into Jest v20+ compatible syntax.
 */

import finale from '../utils/finale';

const testFunctionNames = ['after', 'afterEach', 'before', 'beforeEach', 'it', 'test'];
const allFunctionNames = ['describe'].concat(testFunctionNames);
const ignoredIdentifiers = ['retries', 'skip', 'slow', 'timeout'];
const contextName = 'testContext';

function isFunctionExpressionWithinSpecificFunctions(path, acceptedFunctionNames) {
    if (!path || !path.parentPath || !Array.isArray(path.parentPath.value)) {
        return false;
    }

    const callExpressionPath = path.parentPath.parentPath;

    return (
        !!callExpressionPath &&
        !!callExpressionPath.value &&
        callExpressionPath.value.callee &&
        callExpressionPath.value.callee.type === 'Identifier' &&
        acceptedFunctionNames.indexOf(callExpressionPath.value.callee.name) > -1
    );
}

function isWithinObjectOrClass(path) {
    const invalidParentTypes = ['Property', 'MethodDefinition'];
    let currentPath = path;

    while (
        currentPath &&
        currentPath.value &&
        invalidParentTypes.indexOf(currentPath.value.type) === -1
    ) {
        currentPath = currentPath.parentPath;
    }
    return currentPath ? invalidParentTypes.indexOf(currentPath.value.type) > -1 : false;
}

function isWithinSpecificFunctions(path, acceptedFunctionNames, matchAll) {
    if (!matchAll) {
        // Do not replace within functions declared as object properties or class methods
        // See `transforms plain functions within lifecycle methods` test
        if (isWithinObjectOrClass(path)) {
            return false;
        }
    }
    let currentPath = path;

    while (
        currentPath &&
        currentPath.value &&
        currentPath.value.type !== 'FunctionExpression'
    ) {
        currentPath = currentPath.parentPath;
    }

    return (
        isFunctionExpressionWithinSpecificFunctions(currentPath, acceptedFunctionNames) ||
        (currentPath
            ? isWithinSpecificFunctions(currentPath.parentPath, testFunctionNames, false)
            : false)
    );
}

export default function jasmineThis(fileInfo, api, options) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    const getValidThisExpressions = node => {
        return j(node)
            .find(j.MemberExpression, {
                object: {
                    type: j.ThisExpression.name,
                },
                property: {
                    name: name => ignoredIdentifiers.indexOf(name) === -1,
                },
            })
            .filter(path => isWithinSpecificFunctions(path, allFunctionNames, true));
    };

    const mutateScope = (ast, body) => {
        const replacedIdentifiers = [];

        const updateThisExpressions = () => {
            return ast
                .find(j.MemberExpression, {
                    object: {
                        type: j.ThisExpression.name,
                    },
                })
                .filter(path => isWithinSpecificFunctions(path, allFunctionNames, true))
                .replaceWith(replaceThisExpression)
                .size();
        };

        const replaceThisExpression = path => {
            const name = path.value.property.name;

            replacedIdentifiers.push(name);

            return j.memberExpression(
                j.identifier(contextName),
                j.identifier(name),
                false
            );
        };

        const addDeclarations = () => {
            if (!replacedIdentifiers.length) {
                return;
            }
            body.unshift(
                j.expressionStatement(
                    j.callExpression(j.identifier('beforeEach'), [
                        j.arrowFunctionExpression(
                            [],
                            j.blockStatement([
                                j.expressionStatement(
                                    j.assignmentExpression(
                                        '=',
                                        j.identifier(contextName),
                                        j.objectExpression([])
                                    )
                                ),
                            ])
                        ),
                    ])
                )
            );
            body.unshift(
                j.variableDeclaration('let', [
                    j.variableDeclarator(j.identifier(contextName), null),
                ])
            );
        };

        updateThisExpressions();
        addDeclarations();
    };

    const mutateDescribe = path => {
        const functionExpression = path.value.arguments.find(
            node =>
                node.type === 'FunctionExpression' ||
                node.type === 'ArrowFunctionExpression'
        );
        const functionBody = functionExpression.body;
        const ast = j(functionBody);

        mutateScope(ast, functionBody.body);
    };

    const updateRoot = () => {
        const topLevelLifecycleMethods = root
            .find(j.CallExpression, {
                callee: {
                    type: j.Identifier.name,
                    name: name => testFunctionNames.indexOf(name) > -1,
                },
            })
            // Find only lifecyle methods which are in the root scope
            .filter(
                path =>
                    path.parentPath.value.type === j.ExpressionStatement.name &&
                    Array.isArray(path.parentPath.parentPath.value) &&
                    path.parentPath.parentPath.parentPath.value.type === j.Program.name
            )
            .filter(path => getValidThisExpressions(path.value).size() > 0)
            .size();

        if (topLevelLifecycleMethods > 0) {
            const path = root.get();
            mutateScope(root, path.value.program.body);
            return 1;
        }

        return 0;
    };

    const updateDescribes = () => {
        return root
            .find(j.CallExpression, {
                callee: {
                    type: j.Identifier.name,
                    name: 'describe',
                },
            })
            .filter(path => getValidThisExpressions(path.value).size() > 0)
            .forEach(mutateDescribe)
            .size();
    };

    const updateFunctionExpressions = () => {
        return root
            .find(j.FunctionExpression)
            .filter(path =>
                isFunctionExpressionWithinSpecificFunctions(path, allFunctionNames)
            )
            .replaceWith(path => {
                const newFn = j.arrowFunctionExpression(
                    path.value.params,
                    path.value.body,
                    path.value.expression
                );
                newFn.async = path.value.async;
                return newFn;
            })
            .size();
    };

    const mutations = updateRoot() + updateDescribes() + updateFunctionExpressions();

    if (!mutations) {
        return null;
    }

    return finale(fileInfo, j, root, options);
}
