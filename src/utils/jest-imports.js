import { JEST_MOCK_PROPERTIES } from './consts';
import { addRequireOrImportOnceFactory } from './imports';

export default function updateJestImports(
    j,
    ast,
    isStandaloneMode,
    expectFunctionName = 'expect'
) {
    const addRequireOrImportOnce = addRequireOrImportOnceFactory(j, ast);

    // TODO: ensure expect is imported.
    ast
        .find(j.CallExpression, {
            callee: {
                type: 'MemberExpression',
                object: { type: 'Identifier', name: expectFunctionName },
                property: { name: p => JEST_MOCK_PROPERTIES.has(p) },
            },
        })
        .forEach(path => {
            const { callee } = path.node;
            if (isStandaloneMode) {
                const mockLocalName = 'mock';
                addRequireOrImportOnce(mockLocalName, 'jest-mock');
                callee.object = mockLocalName;
            } else {
                callee.object = 'jest';
            }
        });
}
