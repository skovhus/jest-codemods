import { findParentOfType, findParentVariableDeclaration } from './recast-helpers'

export function addRequireOrImport(j: any, ast: any, localName: string, pkg: string) {
  const { statement } = j.template

  const requires = ast.find(j.CallExpression, {
    callee: { name: 'require' },
  })

  let requireStatement
  if (requires.size()) {
    requireStatement = statement`const ${localName} = require(${j.literal(pkg)});`
  } else {
    requireStatement = j.importDeclaration(
      [j.importDefaultSpecifier(j.identifier(localName))],
      j.literal(pkg)
    )
  }

  ast
    .find(j.Program)
    .get('body', 0)
    .insertBefore(requireStatement)
}

export function addRequireOrImportOnceFactory(j: any, ast: any) {
  const pkgs = new Set([])
  return (localName, pkg) => {
    if (!pkgs.has(pkg)) {
      addRequireOrImport(j, ast, localName, pkg)
      pkgs.add(pkg)
    }
  }
}

export function findRequires(j: any, ast: any, pkg: string) {
  return ast
    .find(j.CallExpression, {
      callee: { name: 'require' },
      arguments: arg => arg[0].value === pkg,
    })
    .filter(p => p.value.arguments.length === 1)
}

export function findImports(j, ast, pkg) {
  return ast.find(j.ImportDeclaration, {
    source: {
      value: pkg,
    },
  })
}

/**
 * Detects CommonJS and import statements for the given package.
 * @return true if import were found, else false
 */
export function hasRequireOrImport(j: any, ast: any, pkg: string) {
  const requires = findRequires(j, ast, pkg).size()
  const imports = findImports(j, ast, pkg).size()
  return requires + imports > 0
}

function findParentPathMemberRequire(path) {
  if (path.parentPath && path.parentPath.value.type === 'MemberExpression') {
    return path.parentPath.value.property
  }
  return null
}

/**
 * Returns localName for any CommonJS or import statements for the given package.
 * @return string if import were found, else undefined
 */
export function getRequireOrImportName(j: any, ast: any, pkg: string) {
  let localName = null
  findRequires(j, ast, pkg).forEach(p => {
    const variableDeclarationPath = findParentVariableDeclaration(p)
    if (variableDeclarationPath) {
      localName = variableDeclarationPath.value.id.name
    }
  })

  findImports(j, ast, pkg).forEach(p => {
    const pathSpecifier = p.value.specifiers[0]
    if (pathSpecifier && pathSpecifier.type === 'ImportDefaultSpecifier') {
      localName = pathSpecifier.local.name
    }
  })

  return localName
}

/**
 * Detects and removes default import statements for given package.
 * @return the local name for the default import or null
 */
export function removeDefaultImport(j: any, ast: any, pkg: string) {
  const getBodyNode = () => ast.find(j.Program).get('body', 0).node
  const { comments } = getBodyNode()

  let localName = null
  findImports(j, ast, pkg).forEach(p => {
    const pathSpecifier = p.value.specifiers[0]
    if (pathSpecifier && pathSpecifier.type === 'ImportDefaultSpecifier') {
      localName = pathSpecifier.local.name
      p.prune()
    }
  })

  getBodyNode().comments = comments

  return localName
}

function findVariableDeclarator(p) {
  if (p.value.type === 'VariableDeclarator') {
    return p
  }

  return p.parentPath ? findVariableDeclarator(p.parentPath) : null
}

/**
 * Detects and removes CommonJS and import statements for given package.
 * @return the import variable name or null if no import were found.
 */
export function removeRequireAndImport(
  j: any,
  ast: any,
  pkg: string,
  specifier?: string
) {
  const getBodyNode = () => ast.find(j.Program).get('body', 0).node
  const { comments } = getBodyNode()

  let localName = null
  let importName = null
  findRequires(j, ast, pkg).forEach(p => {
    const variableDeclarationPath = findParentVariableDeclaration(p)
    const parentMember = findParentPathMemberRequire(p)

    // Examples:
    //   const chai = require('chai');
    //   const expect = require('chai').expect;
    if (!specifier || (parentMember && parentMember.name === specifier)) {
      if (variableDeclarationPath) {
        localName = variableDeclarationPath.value.id.name
        variableDeclarationPath.prune()
      } else {
        const expressionPath = findParentOfType(p, 'ExpressionStatement')
        if (expressionPath) {
          expressionPath.prune()
        } else {
          p.prune()
        }
      }
      return
    }

    // Examples:
    //   const { expect } = require('chai');
    //   const { expect: expct } = require('chai');
    if (
      specifier &&
      variableDeclarationPath &&
      variableDeclarationPath.value &&
      variableDeclarationPath.value.id.type === 'ObjectPattern'
    ) {
      const { properties } = variableDeclarationPath.value.id

      const index = properties.findIndex(prop => {
        return prop.key.type === 'Identifier' && prop.key.name === specifier
      })

      if (index !== undefined) {
        const propertyPath = variableDeclarationPath.get('id', 'properties', index)

        localName = propertyPath.value.value.name

        if (properties.length === 1) {
          // Remove the variable declaration if there's only one property
          // e.g. const { expect } = require('chai');
          variableDeclarationPath.prune()
        } else {
          // Only remove the property if other properties exist
          // e.g. const { expect, other } = require('chai');
          propertyPath.prune()
        }
        return
      }
    }

    /**
     * Examples:
     *   const chai = require('chai');
     *   const expect = chai.expect;
     *
     *   const chai = require('chai');
     *   const { expect } = chai;
     */
    if (variableDeclarationPath && specifier) {
      const memberUsagesOfPkg = ast.find(j.MemberExpression, {
        object: node =>
          node &&
          node.type === 'Identifier' &&
          node.name === variableDeclarationPath.value.id.name,
      })

      const initUsagesOfPkg = ast.find(j.VariableDeclarator, {
        init: node =>
          node &&
          node.type === 'Identifier' &&
          node.name === variableDeclarationPath.value.id.name,
      })

      const usagesOfPkg = memberUsagesOfPkg.length + initUsagesOfPkg.length

      // const chai = require('chai');
      // const { expect } = chai;
      ast
        .find(j.VariableDeclarator, {
          id: node => node.type === 'ObjectPattern',
          init: node =>
            node &&
            node.type === 'Identifier' &&
            node.name === variableDeclarationPath.value.id.name,
        })
        .forEach(p => {
          const index = p.value.id.properties.findIndex(
            prop => prop.key.type === 'Identifier' && prop.key.name === specifier
          )

          if (index >= 0) {
            const property = p.get('id', 'properties', index)
            localName = property.value.value.name
            if (p.value.id.properties.length === 1) {
              p.prune()
              if (usagesOfPkg <= 1) {
                variableDeclarationPath.prune()
              }
            } else {
              property.prune()
            }
          }
        })

      // const chai = require('chai');
      // const expect = chai.expect;
      ast
        .find(j.MemberExpression, {
          object: node =>
            variableDeclarationPath.value &&
            node.type === 'Identifier' &&
            node.name === variableDeclarationPath.value.id.name,
          property: node => node.type === 'Identifier' && node.name === specifier,
        })
        .map(p => findVariableDeclarator(p))
        .filter(Boolean)
        .forEach(p => {
          localName = p.value.id.name
          p.prune()
          if (usagesOfPkg <= 1) {
            variableDeclarationPath.prune()
          }
        })
    }
  })

  findImports(j, ast, pkg).forEach(p => {
    const pathSpecifier = p.value.specifiers[0]
    importName = pathSpecifier && pathSpecifier.imported && pathSpecifier.imported.name

    if (!specifier || importName === specifier) {
      if (pathSpecifier) {
        localName = pathSpecifier.local.name
      }
      p.prune()
    }
  })

  getBodyNode().comments = comments

  return localName
}
