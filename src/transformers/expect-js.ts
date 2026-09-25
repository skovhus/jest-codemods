/*
   This a codeshift for 'expect.js' to Jest's expect
    https://github.com/Automattic/expect.js

    No support yet for the follow expect.js conventions:

    expect({ a: 'b', c: 'd' }).to.only.have.keys(['a', 'c']);
*/
import finale from '../utils/finale'
import { getRequireOrImportName, removeRequireAndImport } from '../utils/imports'
import logger from '../utils/logger'

const MATCHES = {
  be: 'toBe',
  equal: 'toBe',
  eql: 'toEqual',
  contain: 'toContain',
  length: 'toHaveLength',
  property: 'toHaveProperty',
  key: 'toHaveProperty',
  above: 'toBeGreaterThan',
  greaterThan: 'toBeGreaterThan',
  gt: 'toBeGreaterThan',
  below: 'toBeLessThan',
  lessThan: 'toBeLessThan',
  lt: 'toBeLessThan',
  match: 'toMatch',
}

const NOT_SUPPORTED = ['keys']

const SPECIAL_MATCHES = [
  'ok',
  'fail',
  'a',
  'an',
  'empty',
  'throwError',
  'throw',
  'throwException',
  'within',
]
const TYPE_OF_MATCHES = [
  'function',
  'string',
  'object',
  'number',
  'undefined',
  'boolean',
  'symbol',
]
const MATCHER_METHODS = Object.keys(MATCHES).concat(SPECIAL_MATCHES).concat(NOT_SUPPORTED)

const EXPECT_JS = 'expect.js'

export default function expectJsTransfomer(fileInfo, api, options) {
  const j = api.jscodeshift
  const ast = j(fileInfo.source)
  const expectImport = getRequireOrImportName(j, ast, EXPECT_JS)
  const logWarning = (msg, node) => logger(fileInfo, msg, node)

  if (!expectImport && !options.skipImportDetection) {
    // No expect.js require/import were found
    return fileInfo.source
  }

  removeRequireAndImport(j, ast, EXPECT_JS)

  const t = makeTransformApi(j)

  // transform expect.js assertion syntax
  // Match CallExpressions (not only ExpressionStatements) so concise arrow
  // bodies like `.then((id) => expect(id).to.be.ok())` are converted too (#162).
  ast
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: (node) => {
          return node.type === 'Identifier' && MATCHER_METHODS.indexOf(node.name) !== -1
        },
      },
    })
    .filter((path) => Boolean(getExpectCallExpression(path.value)))
    .forEach((path) => {
      const callExpression = path.value
      const expectCall = getExpectCallExpression(callExpression)
      const negation = hasNegation(callExpression)
      const matcherArg = callExpression.arguments[0]
      const { name } = callExpression.callee.property

      let replacement
      switch (name) {
        case 'ok':
          replacement = t.transform(negation ? 'toBeFalsy' : 'toBeTruthy', expectCall)
          break
        case 'fail':
          replacement = j.throwStatement(
            j.callExpression(j.identifier('Error'), matcherArg ? [matcherArg] : [])
          )
          break
        case 'a':
        case 'an':
          replacement = t.makeInstanceOfExpect(expectCall, negation, matcherArg)
          break
        case 'empty':
          replacement = t.transform(
            'toHaveLength',
            expectCall,
            negation,
            j.identifier('0')
          )
          break
        case 'throwError':
        case 'throw':
        case 'throwException':
          replacement = t.makeThrowExpect(expectCall, negation, matcherArg)
          break
        case 'within':
          replacement = t.makeWithinExpect(
            expectCall,
            negation,
            matcherArg,
            callExpression.arguments[1]
          )
          break
        case 'keys':
          logWarning('Unsupported Expect.js Assertion "*.keys"', path)
          return
        default:
          replacement = t.transform(MATCHES[name], expectCall, negation, matcherArg)
      }

      const { parent } = path
      const isStatement =
        replacement.type === 'ExpressionStatement' ||
        replacement.type === 'ThrowStatement' ||
        replacement.type === 'TryStatement'

      if (parent.value.type === 'ExpressionStatement') {
        j(parent).replaceWith(
          isStatement ? replacement : j.expressionStatement(replacement)
        )
      } else if (isStatement && parent.value.type === 'ArrowFunctionExpression') {
        // Concise arrow cannot host a statement — expand body into a block.
        const bodyStmt = isStatement ? replacement : j.expressionStatement(replacement)
        parent.value.body = j.blockStatement([bodyStmt])
      } else if (isStatement) {
        logWarning('Unsupported Expect.js assertion in non-statement position', path)
      } else {
        j(path).replaceWith(replacement)
      }
    })

  return finale(fileInfo, j, ast, options, expectImport)
}

function makeTransformApi(j) {
  function makeNewExpect(expectArg) {
    return j.callExpression(j.identifier('expect'), [expectArg])
  }

  function transform(matcher, expectCall, negation = false, expectation = null) {
    return j.callExpression(
      j.memberExpression(expectCall, j.identifier((negation ? 'not.' : '') + matcher)),
      expectation ? [expectation] : []
    )
  }

  function makeInstanceOfExpect(expectCall, negation, expectation) {
    if (expectation.value) {
      if (TYPE_OF_MATCHES.indexOf(expectation.value) !== -1) {
        const expectCallArg = expectCall.arguments[0]
        return transform(
          'toBe',
          makeNewExpect(j.unaryExpression('typeof', expectCallArg)),
          negation,
          expectation
        )
      } else if (expectation.value === 'array') {
        return transform('toBeInstanceOf', expectCall, negation, j.identifier('Array'))
      }
    }
    return transform('toBeInstanceOf', expectCall, negation, expectation)
  }

  function makeWithinExpect(expectCall, negation, arg1, arg2) {
    const expectArg = expectCall.arguments[0]
    return transform(
      'toBeTruthy',
      makeNewExpect(
        j.logicalExpression(
          '&&',
          j.binaryExpression('>', expectArg, arg1),
          j.binaryExpression('<', expectArg, arg2)
        )
      )
    )
  }

  function makeThrowExpect(expectCall, negation, matcherArg) {
    if (matcherArg && matcherArg.type === 'FunctionExpression') {
      const expectFn =
        expectCall.arguments[0].type === 'Identifier'
          ? j.identifier(expectCall.arguments[0].name)
          : expectCall.arguments[0]
      return j.tryStatement(
        j.blockStatement([
          j.expressionStatement(j.callExpression(expectFn, [])),
          j.throwStatement(
            j.callExpression(j.identifier('Error'), [j.literal(`Function did not throw`)])
          ),
        ]),
        j.catchClause(matcherArg.params[0], null, j.blockStatement(matcherArg.body.body))
      )
    }
    const matcher = matcherArg ? 'toThrowError' : 'toThrow'
    return transform(matcher, expectCall, negation, matcherArg)
  }

  return {
    makeNewExpect,
    makeInstanceOfExpect,
    makeWithinExpect,
    makeThrowExpect,
    transform,
  }
}

function getExpectCallExpression(node) {
  if (node.type === 'CallExpression') {
    if (node.callee.type === 'Identifier' && node.callee.name === 'expect') {
      return node
    }
    return getExpectCallExpression(node.callee)
  } else if (node.type === 'MemberExpression') {
    return getExpectCallExpression(node.object)
  }
  return false
}

function hasNegation(node) {
  if (node.type === 'CallExpression') {
    return hasNegation(node.callee)
  } else if (node.type === 'MemberExpression') {
    if (node.property.type === 'Identifier' && node.property.name === 'not') {
      return true
    }
    return hasNegation(node.object)
  }
  return false
}
