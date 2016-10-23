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

function findParentVariableDeclaration(path) {
    if (path.value.type === 'VariableDeclarator') {
        return path;
    }
    return findParentVariableDeclaration(path.parentPath);
}

/**
 * Detects and removes CommonJS and import statements for given package.
 * @return the import variable name or null if no import were found.
 */
export function removeRequireAndImport(j, ast, pkg) {
    const getBodyNode = () => ast.find(j.Program).get('body', 0).node;
    const { comments } = getBodyNode(j, ast);

    let variableName = null;
    findRequires(j, ast, pkg)
    .forEach(p => {
        const variableDeclarationPath = findParentVariableDeclaration(p);
        variableName = variableDeclarationPath.value.id.name;
        variableDeclarationPath.prune();
    });

    findImports(j, ast, pkg)
    .forEach(p => {
        variableName = p.value.specifiers[0].local.name;
        p.prune();
    });

    getBodyNode(j, ast).comments = comments;

    return variableName;
}
