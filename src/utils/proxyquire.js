import { removeRequireAndImport } from './imports';
import logger from './logger';

const findChildOfProgram = (path, childPath) => {
    if (path.value.type === 'Program') {
        return childPath;
    }
    return findChildOfProgram(path.parent, path);
};

const getJestMockStatement = ({ j, mockName, mockBody }) =>
    j.expressionStatement(
        j.callExpression(
            j.identifier('jest.mock'),
            [
                mockName,
                j.arrowFunctionExpression([], mockBody),
            ]
        )
    );

export default function proxyquireTransformer(fileInfo, j, ast) {
    const variableName = removeRequireAndImport(j, ast, 'proxyquire');
    if (variableName) {
        const mocks = new Set();

        ast.find(j.Identifier, {
            name: variableName,
        }).forEach(p => {
            const { node } = p.parentPath;
            if (node.type !== 'CallExpression' && node.type !== 'MemberExpression') {
                return;
            }

            const argumentPath = node.type === 'CallExpression' ? p.parentPath : p.parent.parent.parent;
            const args = argumentPath.node.arguments;

            if (!args) {
                // proxyquire is called with no arguments
                j(argumentPath).remove();
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
                    findChildOfProgram(argumentPath).insertBefore(jestMockStatement);
                });
            } else if (mocksNode.type === 'Identifier') {
                // Look for an ObjectExpression that defines the mocks
                let mocksObjectExpression;
                ast.find(j.VariableDeclarator, {
                    id: { name: mocksNode.name },
                })
                .filter(path => path.node.init.type === 'ObjectExpression')
                .forEach(path => {
                    mocksObjectExpression = path.node.init;
                });

                if (!mocksObjectExpression) {
                    logger(fileInfo, 'proxyrequire mocks not transformed due to missing declaration', p);
                    return;
                }

                mocksObjectExpression.properties.forEach(o => {
                    const mockName = o.key;
                    const jestMockStatement = getJestMockStatement({
                        j,
                        mockName,
                        mockBody: j.memberExpression(
                            j.identifier(mocksNode.name), mockName
                        ),
                    });
                    findChildOfProgram(argumentPath).insertBefore(jestMockStatement);
                });
            } else {
                return;
            }

            const newCallExpressionNode = j.callExpression(
                j.identifier('require'), [j.literal(requireFile)]
            );
            j(argumentPath).replaceWith(newCallExpressionNode);
        });
    }
}
