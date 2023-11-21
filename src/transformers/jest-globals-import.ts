import type { ImportSpecifier, JSCodeshift } from 'jscodeshift'

import { JEST_GLOBALS } from '../utils/consts'
import { findImports, removeRequireAndImport } from '../utils/imports'

const jestGlobalsImport = (
  fileInfo: { path: string; source: string },
  api: { jscodeshift: JSCodeshift }
) => {
  const { jscodeshift: j } = api
  const ast = j(fileInfo.source)

  const jestGlobalsUsed = new Set<string>()

  JEST_GLOBALS.forEach((globalName) => {
    if (
      ast
        .find(j.CallExpression, { callee: { name: globalName } })
        .filter((callExpression) => !callExpression.scope.lookup(globalName))
        .size() > 0 ||
      ast
        .find(j.MemberExpression, { object: { name: globalName } })
        .filter((memberExpression) => !memberExpression.scope.lookup(globalName))
        .size() > 0
    ) {
      jestGlobalsUsed.add(globalName)
    }
  })

  const jestGlobalsImports = findImports(j, ast, '@jest/globals')
  const hasJestGlobalsImport = jestGlobalsImports.length > 0
  const needsJestGlobalsImport = jestGlobalsUsed.size > 0

  if (!needsJestGlobalsImport) {
    if (!hasJestGlobalsImport) return null
    removeRequireAndImport(j, ast, '@jest/globals')
  } else {
    const jestGlobalsImport = hasJestGlobalsImport
      ? jestGlobalsImports.get().value
      : j.importDeclaration([], j.stringLiteral('@jest/globals'))
    const { specifiers } = jestGlobalsImport
    const existingNames = new Set<string>(
      specifiers.map((s: ImportSpecifier) => s.imported.name)
    )
    jestGlobalsUsed.forEach((jestGlobal) => {
      if (!existingNames.has(jestGlobal)) {
        specifiers.push(j.importSpecifier(j.identifier(jestGlobal)))
      }
    })
    if (!hasJestGlobalsImport) {
      ast.find(j.Program).get('body', 0).insertBefore(jestGlobalsImport)
    }
  }

  return ast.toSource({ quote: 'single' })
}

export default jestGlobalsImport
