import { removeRequireAndImport } from './imports';

export default function proxyquireTransformer(j, ast) {
    const variableName = removeRequireAndImport(j, ast, 'proxyquire');
    if (variableName) {
        ast.find(j.Identifier, {
            name: variableName,
        }).forEach(p => {
            const { node } = p.parentPath;

            if (node.type !== 'CallExpression' && node.type !== 'MemberExpression') {
                // proxyquire(...)
                // proxyquire.noCallThru(...)
                // TODO: log
                throw new Error('wut!');
            }

            const argumentPath = node.type === 'CallExpression' ? p.parentPath : p.parent.parent.parent;
            const args = argumentPath.node.arguments;
            const requireFile = args[0].value;
            const mocksObjectExpression = args[1];
            const newCallExpressionNode = j.callExpression(
                j.identifier('require'), [j.literal(requireFile)]
            );

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
