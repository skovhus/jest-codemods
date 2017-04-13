import { removeRequireAndImport } from './imports';
import logger from './logger';

function findChildOfProgram(path, childPath) {
    if (path.value.type === 'Program') {
        return childPath;
    }
    return findChildOfProgram(path.parent, path);
}

function findFirstParentCallExpression(path) {
    if (!path) {
        return null;
    }
    if (path.node.type === 'CallExpression') {
        return findFirstParentCallExpression(path.parentPath) || path;
    }
    return findFirstParentCallExpression(path.parentPath);
}

const getJestMockStatement = ({ j, mockName, mockBody }) =>
    j.expressionStatement(
        j.callExpression(j.identifier('jest.mock'), [
            mockName,
            j.arrowFunctionExpression([], mockBody),
        ])
    );

export default function proxyquireTransformer(fileInfo, j, ast) {
    const importVariableName = removeRequireAndImport(j, ast, 'proxyquire');
    if (importVariableName) {
        const mocks = new Set();

        ast
            .find(j.Identifier, {
                name: importVariableName,
            })
            .forEach(p => {
                const outerCallExpression = findFirstParentCallExpression(p);
                if (!outerCallExpression) {
                    return;
                }

                const args = outerCallExpression.node.arguments;
                if (args.length === 0) {
                    // proxyquire is called with no arguments
                    j(outerCallExpression).remove();
                    return;
                }

                const requireFile = args[0].value;
                const mocksNode = args[1];

                if (mocks.has(requireFile)) {
                    logger(fileInfo, 'Multiple mocks of same file is not supported', p);
                    return;
                }
                mocks.add(requireFile);

                if (mocksNode.type === 'ObjectExpression') {
                    mocksNode.properties.forEach(o => {
                        const jestMockStatement = getJestMockStatement({
                            j,
                            mockName: o.key,
                            mockBody: o.value,
                        });
                        findChildOfProgram(outerCallExpression).insertBefore(
                            jestMockStatement
                        );
                    });
                } else if (mocksNode.type === 'Identifier') {
                    // Look for an ObjectExpression that defines the mocks
                    let mocksObjectExpression;
                    ast
                        .find(j.VariableDeclarator, {
                            id: { name: mocksNode.name },
                        })
                        .filter(path => path.node.init.type === 'ObjectExpression')
                        .forEach(path => {
                            mocksObjectExpression = path.node.init;
                        });

                    if (!mocksObjectExpression) {
                        logger(
                            fileInfo,
                            'proxyrequire mocks not transformed due to missing declaration',
                            p
                        );
                        return;
                    }

                    mocksObjectExpression.properties.forEach(o => {
                        const mockName = o.key;
                        const jestMockStatement = getJestMockStatement({
                            j,
                            mockName,
                            mockBody: j.memberExpression(
                                j.identifier(mocksNode.name),
                                mockName
                            ),
                        });
                        findChildOfProgram(outerCallExpression).insertBefore(
                            jestMockStatement
                        );
                    });
                } else {
                    return;
                }

                const newCallExpressionNode = j.callExpression(j.identifier('require'), [
                    j.literal(requireFile),
                ]);
                j(outerCallExpression).replaceWith(newCallExpressionNode);
            });
    }
}
