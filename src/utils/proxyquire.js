import { removeRequireAndImport } from './imports';
import logger from './logger';

export default function proxyquireTransformer(fileInfo, j, ast) {
    const variableName = removeRequireAndImport(j, ast, 'proxyquire');
    if (variableName) {
        const mocks = new Set();

        ast.find(j.Identifier, {
            name: variableName,
        }).forEach(p => {
            const { node } = p.parentPath;

            if (node.type !== 'CallExpression' && node.type !== 'MemberExpression') {
                // proxyquire(...)
                // proxyquire.noCallThru(...)
                return;
            }

            const argumentPath = node.type === 'CallExpression' ? p.parentPath : p.parent.parent.parent;
            const args = argumentPath.node.arguments;
            const requireFile = args[0].value;
            const mocksObjectExpression = args[1];
            const newCallExpressionNode = j.callExpression(
                j.identifier('require'), [j.literal(requireFile)]
            );

            if (mocks.has(requireFile)) {
                logger(fileInfo, 'Multiple mocks of same file is not supported', p);
                return;
            }
            mocks.add(requireFile);

            j(argumentPath).replaceWith(newCallExpressionNode);
            mocksObjectExpression.properties.forEach(o => {
                const jestMockStatement = j.expressionStatement(
                    j.callExpression(
                        j.identifier('jest.mock'), [o.key, j.arrowFunctionExpression([], o.value)]
                    )
                );
                argumentPath.parent.parent.insertBefore(jestMockStatement);
            });
        });
    }
}
