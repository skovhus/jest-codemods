import fs from 'fs'
import type { Collection, ImportSpecifier, JSCodeshift } from 'jscodeshift'
import path from 'path'

// Inserts a new import statement at the top of the file.
const addImport = ({
  j,
  ast,
  src,
  defaultImportName,
  namedImports = new Set(),
}: {
  j: JSCodeshift
  ast: Collection
  src: string
  defaultImportName?: string // e.g. the `React` in `import React from 'react';`.
  namedImports?: Set<string> // e.g. the `{ name }` in `import { readFileSync } from 'fs';`.
}) => {
  const specifiers = []

  if (defaultImportName) {
    specifiers.push(j.importDefaultSpecifier(j.identifier(defaultImportName)))
  }
  Array.from(namedImports)
    .sort()
    .forEach((name) => {
      specifiers.push(j.importSpecifier(j.identifier(name)))
    })
  const newImport = j.importDeclaration(specifiers, j.stringLiteral(src))

  const program = ast.find(j.Program)
  const hasTopComment = program.get('body', 0).node.comments?.length > 0
  program.get('body', hasTopComment ? 1 : 0).insertBefore(newImport)
}

const ensureImportExists = ({
  j,
  ast,
  src,
  namedImports = new Set(),
}: {
  j: JSCodeshift
  ast: Collection
  src: string
  namedImports?: Set<string>
}) => {
  const importDec = ast.find(j.ImportDeclaration, {
    source: {
      value: src,
    },
  })

  if (importDec.length === 0) {
    addImport({ j, ast, src, namedImports })
    return
  }

  const { specifiers } = importDec.get().value

  namedImports.forEach((name) => {
    const importSpec = importDec.find(j.ImportSpecifier, { imported: { name } })
    if (importSpec.length >= 1) return
    specifiers.push(j.importSpecifier(j.identifier(name)))
  })

  specifiers.sort((spec1: ImportSpecifier, spec2: ImportSpecifier) =>
    spec1.imported.name > spec2.imported.name ? 1 : -1
  )
}

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

  const existingJestGlobalsImport = ast.find(j.ImportDeclaration, {
    importKind: 'value',
    source: { value: '@jest/globals' },
  })

  const hasJestGlobalsImport = existingJestGlobalsImport.size() > 0
  const needsJestGlobalsImport = jestGlobalsUsed.size > 0

  if (!needsJestGlobalsImport) {
    if (!hasJestGlobalsImport) return null
    existingJestGlobalsImport.remove()
  } else {
    ensureImportExists({ j, ast, src: '@jest/globals', namedImports: jestGlobalsUsed })
  }

  return ast.toSource({ quote: 'single' })
}

export default jestGlobalsImport
