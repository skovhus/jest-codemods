export function findRequires(j, ast, pkg) {
    return ast.find(j.CallExpression, {
        callee: { name: 'require' },
        arguments: arg => arg[0].value === pkg,
    })
    .filter(p => p.value.arguments.length === 1);
}

export function findImports(j, ast, pkg) {
    return ast.find(j.ImportDeclaration, {
        source: {
            value: pkg,
        },
    });
}

/**
 * Detects CommonJS and import statements for the given package.
 * @return true if import were found, else false
 */
export function hasRequireOrImport(j, ast, pkg) {
    const requires = findRequires(j, ast, pkg).size();
    const imports = findImports(j, ast, pkg).size();
    return requires + imports > 0;
}

/**
 * Detects and removes CommonJS and import statements for given package.
 * @return the import variable name or null if no import were found.
 */
export function removeRequireAndImport(j, ast, pkg) {
    const getBodyNode = () => ast.find(j.Program).get('body', 0).node;
    const { comments } = getBodyNode(j, ast);

    let testFunctionName = null;
    findRequires(j, ast, pkg)
    .forEach(p => {
        testFunctionName = p.parentPath.value.id.name;
        p.parentPath.prune();
    });

    findImports(j, ast, pkg)
    .forEach(p => {
        testFunctionName = p.value.specifiers[0].local.name;
        p.prune();
    });

    getBodyNode(j, ast).comments = comments;

    return testFunctionName;
}
