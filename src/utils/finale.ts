import jscodeshift from 'jscodeshift'

import { JEST_MOCK_PROPERTIES } from './consts.js'
import { addRequireOrImportOnceFactory, hasRequireOrImport } from './imports.js'
import detectLineTerminator from './line-terminator.js'
import logger from './logger.js'
import proxyquireTransformer from './proxyquire.js'
import detectQuoteStyle from './quote-style.js'

function detectIncompatiblePackages(fileInfo, j, ast) {
  ;['sinon', 'testdouble'].forEach((pkg) => {
    if (hasRequireOrImport(j, ast, pkg)) {
      const msg = `Usage of package "${pkg}" might be incompatible with Jest`
      if (pkg === 'sinon') {
        return logger(
          fileInfo,
          `${msg}; it's recommended the sinon transformer is run first`
        )
      }
      logger(fileInfo, msg)
    }
  })
}

function updateJestImports(j, ast, isStandaloneMode, testFunctionName = 'jest') {
  const addRequireOrImportOnce = addRequireOrImportOnceFactory(j, ast)

  if (isStandaloneMode && !hasRequireOrImport(j, ast, 'expect')) {
    addRequireOrImportOnce('expect', 'expect')
  }

  ast
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: testFunctionName },
        property: { name: (p) => JEST_MOCK_PROPERTIES.has(p) },
      },
    })
    .forEach((path) => {
      const { callee } = path.node
      if (isStandaloneMode) {
        const mockLocalName = 'mock'
        addRequireOrImportOnce(mockLocalName, 'jest-mock')
        callee.object = mockLocalName
      } else {
        callee.object = 'jest'
      }
    })
}

/**
 * Exposes the finale shared by all transformers.
 * @return the ast.toSource that should be returned to jscodeshift.
 */
export default function finale(
  fileInfo,
  j: jscodeshift.JSCodeshift,
  ast: any,
  transformerOptions,
  testFunctionName?: string
) {
  const { standaloneMode } = transformerOptions

  detectIncompatiblePackages(fileInfo, j, ast)
  updateJestImports(j, ast, standaloneMode, testFunctionName)
  proxyquireTransformer(fileInfo, j, ast)

  // As Recast is not preserving original quoting, we try to detect it,
  // and default to something sane.
  const quote = detectQuoteStyle(j, ast) || 'single'
  const lineTerminator = detectLineTerminator(fileInfo.source)
  return ast.toSource({ quote, lineTerminator })
}
