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
    if (!path) {
        return null;
    }
    if (path.value.type === 'VariableDeclarator') {
        return path;
    }
    return findParentVariableDeclaration(path.parentPath);
}

function findParentPathMemberRequire(path) {
    if (path.parentPath && path.parentPath.value.type === 'MemberExpression') {
        return path.parentPath.value.property;
    }
    return null;
}

/**
 * Detects and removes CommonJS and import statements for given package.
 * @return the import variable name or null if no import were found.
 */
export function removeRequireAndImport(j, ast, pkg, specifier) {
    const getBodyNode = () => ast.find(j.Program).get('body', 0).node;
    const { comments } = getBodyNode(j, ast);

    let localName = null;
    let importName = null;
    findRequires(j, ast, pkg)
    .forEach(p => {
        const variableDeclarationPath = findParentVariableDeclaration(p);
        const parentMember = findParentPathMemberRequire(p);
        if (!specifier || (parentMember && parentMember.name === specifier)) {
            if (variableDeclarationPath) {
                localName = variableDeclarationPath.value.id.name;
                variableDeclarationPath.prune();
            } else {
                p.prune();
            }
        }
    });

    findImports(j, ast, pkg)
    .forEach(p => {
        const pathSpecifier = p.value.specifiers[0];
        importName = pathSpecifier && pathSpecifier.imported && pathSpecifier.imported.name;

        if (!specifier || importName === specifier) {
            if (pathSpecifier) {
                localName = pathSpecifier.local.name;
            }
            p.prune();
        }
    });

    getBodyNode(j, ast).comments = comments;

    return localName;
}
