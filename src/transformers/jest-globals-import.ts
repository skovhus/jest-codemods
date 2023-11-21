import fs from 'fs'
import type { ImportSpecifier, JSCodeshift } from 'jscodeshift'
import path from 'path'

import { findImports, removeRequireAndImport } from '../utils/imports'

const jestGlobals = new Set<string>()

const jestGlobalsPath = path.join(
  __dirname,
  '../../node_modules/@jest/globals/build/index.d.ts'
)

const ensureJestGlobalsPopulated = ({ j }: { j: JSCodeshift }) => {
  if (jestGlobals.size > 0) return

  const jestGlobalsAst = j(String(fs.readFileSync(jestGlobalsPath)), { parser: 'ts' })

  jestGlobalsAst
    .find(j.ExportNamedDeclaration, { declaration: { declare: true } })
    .forEach((exportNamedDec) => {
      if (exportNamedDec.node.declaration?.type !== 'VariableDeclaration') return
      exportNamedDec.node.declaration.declarations.forEach((dec) => {
        if (dec.type !== 'VariableDeclarator' || dec.id?.type !== 'Identifier') return
        jestGlobals.add(dec.id.name)
      })
    })

  jestGlobalsAst
    .find(j.ExportSpecifier, { exported: { name: (n) => typeof n === 'string' } })
    .forEach((exportSpecifier) => {
      jestGlobals.add(exportSpecifier.node.exported.name)
    })
}

const jestGlobalsImport = (
  fileInfo: { path: string; source: string },
  api: { jscodeshift: JSCodeshift }
) => {
  const { jscodeshift: j } = api
  const ast = j(fileInfo.source)

  ensureJestGlobalsPopulated({ j })

  if (jestGlobals.size === 0) throw new Error("couldn't parse @jest/globals exports")

  const jestGlobalsUsed = new Set<string>()

  jestGlobals.forEach((globalName) => {
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
