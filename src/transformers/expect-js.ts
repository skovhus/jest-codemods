/*
   This a codeshift for 'expect.js' to Jest's expect
    https://github.com/Automattic/expect.js

    No support yet for the follow expect.js conventions:

    expect({ a: 'b', c: 'd' }).to.only.have.keys(['a', 'c']);
*/
import finale from '../utils/finale.js'
import { getRequireOrImportName, removeRequireAndImport } from '../utils/imports.js'
import logger from '../utils/logger.js'

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
  ast
    .find(j.ExpressionStatement, {
      expression: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          property: (node) => {
            return node.type === 'Identifier' && MATCHER_METHODS.indexOf(node.name) !== -1
          },
        },
      },
    })
    .replaceWith((path) => {
      const callExpression = path.value.expression
      const expectCall = getExpectCallExpression(callExpression)
      if (!expectCall) {
        return path.node
      }

      const negation = hasNegation(callExpression)
      const matcherArg = callExpression.arguments[0]
      const { name } = callExpression.callee.property
      switch (name) {
        case 'ok':
          return t.transform(negation ? 'toBeFalsy' : 'toBeTruthy', expectCall)
        case 'fail':
          return j.throwStatement(
            j.callExpression(j.identifier('Error'), matcherArg ? [matcherArg] : [])
          )
        case 'a':
        case 'an':
          return t.makeInstanceOfExpect(expectCall, negation, matcherArg)
        case 'empty':
          return t.transform('toHaveLength', expectCall, negation, j.identifier('0'))
        case 'throwError':
        case 'throw':
        case 'throwException':
          return t.makeThrowExpect(expectCall, negation, matcherArg)
        case 'within':
          return t.makeWithinExpect(
            expectCall,
            negation,
            matcherArg,
            callExpression.arguments[1]
          )
        case 'keys':
          logWarning('Unsupported Expect.js Assertion "*.keys"', path)
          return path.node
        default:
          return t.transform(MATCHES[name], expectCall, negation, matcherArg)
      }
    })

  return finale(fileInfo, j, ast, options, expectImport)
}

function makeTransformApi(j) {
  function makeNewExpect(expectArg) {
    return j.callExpression(j.identifier('expect'), [expectArg])
  }

  function transform(matcher, expectCall, negation = false, expectation = null) {
    return j.expressionStatement(
      j.callExpression(
        j.memberExpression(expectCall, j.identifier((negation ? 'not.' : '') + matcher)),
        expectation ? [expectation] : []
      )
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
