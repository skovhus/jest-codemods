/**
 * Detects and removes CommonJS and import statements from given test runner.
 * @return the import variable name or null if no import were found.
 */
export default function removeRequireAndImport(j, ast, testRunnerName) {
    let testFunctionName = null;
    ast.find(j.CallExpression, {
        callee: { name: 'require' },
        arguments: arg => arg[0].value === testRunnerName,
    })
    .filter(p => p.value.arguments.length === 1)
    .forEach(p => {
        testFunctionName = p.parentPath.value.id.name;
        p.parentPath.prune();
    });

    ast.find(j.ImportDeclaration, {
        source: {
            value: testRunnerName,
        },
    })
    .forEach(p => {
        testFunctionName = p.value.specifiers[0].local.name;
        p.prune();
    });

    return testFunctionName;
}
