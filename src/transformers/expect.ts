import { JEST_MATCHER_TO_MAX_ARGS, JEST_MOCK_PROPERTIES } from '../utils/consts'
import finale from '../utils/finale'
import {
  getRequireOrImportName,
  hasRequireOrImport,
  removeRequireAndImport,
} from '../utils/imports'
import logger from '../utils/logger'
import {
  findParentCallExpression,
  findParentOfType,
  findParentVariableDeclaration,
} from '../utils/recast-helpers'

const matcherRenaming = {
  toExist: 'toBeTruthy',
  toNotExist: 'toBeFalsy',
  toNotBe: 'not.toBe',
  toNotEqual: 'not.toEqual',
  toNotThrow: 'not.toThrow',
  toBeA: 'toBeInstanceOf',
  toBeAn: 'toBeInstanceOf',
  toNotBeA: 'not.toBeInstanceOf',
  toNotBeAn: 'not.toBeInstanceOf',
  toNotMatch: 'not.toMatch',
  toBeFewerThan: 'toBeLessThan',
  toBeLessThanOrEqualTo: 'toBeLessThanOrEqual',
  toBeMoreThan: 'toBeGreaterThan',
  toBeGreaterThanOrEqualTo: 'toBeGreaterThanOrEqual',
  toInclude: 'toContain',
  toExclude: 'not.toContain',
  toNotContain: 'not.toContain',
  toNotInclude: 'not.toContain',
  toNotHaveBeenCalled: 'not.toHaveBeenCalled',
}

const matchersToBe = new Set(['toBeA', 'toBeAn', 'toNotBeA', 'toNotBeAn'])

const matchersWithKey = new Set([
  'toContainKey',
  'toExcludeKey',
  'toIncludeKey',
  'toNotContainKey',
  'toNotIncludeKey',
])

const matchersWithKeys = new Set([
  'toContainKeys',
  'toExcludeKeys',
  'toIncludeKeys',
  'toNotContainKeys',
  'toNotIncludeKeys',
])

const expectSpyFunctions = new Set(['createSpy', 'spyOn', 'isSpy', 'restoreSpies'])
const unsupportedSpyFunctions = new Set(['isSpy', 'restoreSpies'])
const unsupportedExpectProperties = new Set(['extend'])
const EXPECT = 'expect'

function splitChainedMatcherPath(j, path) {
  if (path.parentPath.parentPath.node.type !== 'MemberExpression') {
    return
  }

  const pStatement = findParentOfType(path, 'ExpressionStatement')
  const pStatementNode = pStatement.node.original
  const expectCallExpression = path.node.object

  function splitChain(callExpression) {
    const next = callExpression.callee.object
    if (!next) {
      return
    }

    j(path)
      .closest(j.ExpressionStatement)
      .insertAfter(
        j.expressionStatement(
          j.callExpression(
            j.memberExpression(
              j.callExpression(expectCallExpression.callee, [
                ...expectCallExpression.arguments,
              ]),
              callExpression.callee.property
            ),
            callExpression.arguments
          )
        )
      )

    splitChain(next)
  }

  splitChain(pStatementNode.expression)

  pStatement.prune()
}

export default function expectTransformer(fileInfo, api, options) {
  const j = api.jscodeshift
  const ast = j(fileInfo.source)
  const { standaloneMode } = options

  if (!hasRequireOrImport(j, ast, EXPECT) && !options.skipImportDetection) {
    // No expect require/import were found
    return fileInfo.source
  }

  const expectFunctionName = getRequireOrImportName(j, ast, EXPECT) || EXPECT

  if (!standaloneMode) {
    removeRequireAndImport(j, ast, EXPECT)
  }

  const logWarning = (msg, node) => logger(fileInfo, msg, node)

  function balanceMatcherNodeArguments(matcherNode, matcher, path) {
    const newJestMatcherName = matcher.name.replace('not.', '')
    const maxArgs = JEST_MATCHER_TO_MAX_ARGS[newJestMatcherName]
    if (typeof maxArgs === 'undefined') {
      logWarning(`Unknown matcher "${newJestMatcherName}"`, path)
      return
    }

    if (matcherNode.arguments.length > maxArgs) {
      // Try to remove assertion message
      const lastArg = matcherNode.arguments[matcherNode.arguments.length - 1]
      if (lastArg.type === 'Literal') {
        matcherNode.arguments.pop()
      }
    }

    if (matcherNode.arguments.length <= maxArgs) {
      return
    }

    logWarning(
      `Too many arguments given to "${newJestMatcherName}". Expected max ${maxArgs} but got ${matcherNode.arguments.length}`,
      path
    )
  }

  const getMatchers = () =>
    ast.find(j.MemberExpression, {
      object: {
        type: 'CallExpression',
        callee: { type: 'Identifier', name: expectFunctionName },
      },
      property: { type: 'Identifier' },
    })

  const splitChainedMatchers = () =>
    getMatchers().forEach((path) => {
      splitChainedMatcherPath(j, path)
    })

  const updateMatchers = () =>
    getMatchers().forEach((path) => {
      if (!standaloneMode) {
        path.parentPath.node.callee.object.callee.name = EXPECT
      }

      const matcherNode = path.parentPath.node
      const matcher = path.node.property
      const matcherName = matcher.name

      const matcherArgs = matcherNode.arguments
      const expectArgs = path.node.object.arguments

      const isNot =
        matcherName.indexOf('Not') !== -1 || matcherName.indexOf('Exclude') !== -1

      if (matcherRenaming[matcherName]) {
        matcher.name = matcherRenaming[matcherName]
      }

      if (matchersToBe.has(matcherName)) {
        if (matcherArgs[0].type === 'Literal') {
          expectArgs[0] = j.unaryExpression('typeof', expectArgs[0])
          matcher.name = isNot ? 'not.toBe' : 'toBe'
        }
      }

      if (matchersWithKey.has(matcherName)) {
        expectArgs[0] = j.template.expression`Object.keys(${expectArgs[0]})`
        matcher.name = isNot ? 'not.toContain' : 'toContain'
      }

      if (matchersWithKeys.has(matcherName)) {
        const keys = matcherArgs[0]
        matcherArgs[0] = j.identifier('e')
        expectArgs[0] = j.template.expression`Object.keys(${expectArgs[0]})`
        matcher.name = isNot ? 'not.toContain' : 'toContain'
        j(path.parentPath).replaceWith(j.template.expression`\
${keys}.forEach(e => {
  ${matcherNode}
})`)
      }

      if (matcherName === 'toMatch' || matcherName === 'toNotMatch') {
        // expect toMatch handles string, reg exp and object.
        const { name, type } = matcherArgs[0]
        if (type === 'ObjectExpression' || type === 'Identifier') {
          matcher.name = isNot ? 'not.toMatchObject' : 'toMatchObject'

          if (type === 'Identifier') {
            logWarning(`Use "toMatch" if "${name}" is not an object`, path)
          }
        }
      }

      balanceMatcherNodeArguments(matcherNode, matcher, path)
    })

  const updateSpies = () => {
    ast
      .find(j.CallExpression, {
        callee: {
          type: 'Identifier',
          name: (name) => expectSpyFunctions.has(name),
        },
      })
      .forEach(({ value }) => {
        value.callee = j.memberExpression(
          j.identifier(expectFunctionName),
          j.identifier(value.callee.name)
        )
      })

    // Update expect.createSpy calls and warn about restoreSpies
    ast
      .find(j.MemberExpression, {
        object: {
          type: 'Identifier',
          name: expectFunctionName,
        },
        property: { type: 'Identifier' },
      })
      .forEach((path) => {
        const { name } = path.value.property
        if (name === 'createSpy') {
          path.value.property.name = 'fn'
        }

        if (unsupportedSpyFunctions.has(name)) {
          logWarning(`"${path.value.property.name}" is currently not supported`, path)
        }
      })

    // Warn about expect.spyOn calls with variable assignment
    ast
      .find(j.MemberExpression, {
        object: {
          type: 'Identifier',
          name: expectFunctionName,
        },
        property: { type: 'Identifier', name: 'spyOn' },
      })
      .forEach((path) => {
        const parentAssignment =
          findParentOfType(path, 'VariableDeclarator') ||
          findParentOfType(path, 'AssignmentExpression')
        if (!parentAssignment) {
          logWarning(
            `"${path.value.property.name}" without variable assignment might not work as expected (see https://facebook.github.io/jest/docs/jest-object.html#jestspyonobject-methodname)`,
            path
          )
        }
      })

    // Update mock chain calls
    const updateSpyProperty = (path, property) => {
      if (!property) {
        return
      }

      if (property.name === 'andReturn') {
        const callExpression = findParentCallExpression(path, property.name).value
        callExpression.arguments = [
          j.arrowFunctionExpression([j.identifier('()')], callExpression.arguments[0]),
        ]
      }

      if (property.name === 'andThrow') {
        const callExpression = findParentCallExpression(path, property.name).value
        const throughExpression = callExpression.arguments[0]
        callExpression.arguments = [
          j.arrowFunctionExpression(
            [j.identifier('()')],
            j.blockStatement([j.throwStatement(throughExpression)])
          ),
        ]
      }

      if (property.name === 'andCallThrough') {
        const callExpression = findParentCallExpression(path, property.name)
        const innerCallExpression = callExpression.value.callee.object
        j(callExpression).replaceWith(innerCallExpression)
      }

      const propertyNameMap = {
        andCall: 'mockImplementation',
        andReturn: 'mockImplementation',
        andThrow: 'mockImplementation',
        calls: 'mock.calls',
        reset: 'mockClear',
        restore: 'mockReset',
      }

      const newPropertyName = propertyNameMap[property.name]
      if (newPropertyName) {
        property.name = newPropertyName
      }

      // Remap spy.calls[x].arguments
      const potentialArgumentsPath = path.parentPath.parentPath
      const potentialArgumentsNode = potentialArgumentsPath.value
      if (
        property.name === 'mock.calls' &&
        potentialArgumentsNode.property &&
        potentialArgumentsNode.property.name === 'arguments'
      ) {
        const variableName = path.value.object.name
        const callsProperty = path.parentPath.value.property

        if (potentialArgumentsPath.parentPath.value.type !== 'MemberExpression') {
          //  spy.calls[x].arguments =>  spy.mock.calls[x]
          potentialArgumentsPath.replace(
            j.memberExpression(
              j.memberExpression(j.identifier(variableName), j.identifier('mock.calls')),
              callsProperty,
              true
            )
          )
          return
        }

        // spy.calls[x].arguments[y] => spy.mock.calls[x][y]
        const outherNode = path.parentPath.parentPath.parentPath
        const argumentsProperty = outherNode.value.property
        outherNode.replace(
          j.memberExpression(
            j.memberExpression(
              j.memberExpression(j.identifier(variableName), j.identifier('mock.calls')),
              callsProperty,
              true
            ),
            argumentsProperty,
            true
          )
        )
      }
    }

    const spyVariables = []
    ast
      .find(j.MemberExpression, {
        object: {
          type: 'Identifier',
          name: expectFunctionName,
        },
        property: {
          type: 'Identifier',
          name: (name) => JEST_MOCK_PROPERTIES.has(name),
        },
      })
      .forEach((path) => {
        const spyVariable = findParentVariableDeclaration(path)
        if (spyVariable) {
          spyVariables.push(spyVariable.value.id.name)
        }

        const { property } = path.parentPath.parentPath.value

        updateSpyProperty(path, property)
      })

    // Update spy variable methods
    ast
      .find(j.MemberExpression, {
        object: {
          type: 'Identifier',
          name: (name) => spyVariables.indexOf(name) >= 0,
        },
      })
      .forEach((path) => {
        const { property } = path.value
        let spyProperty = null
        if (property.type === 'Identifier') {
          // spy.calls.length
          spyProperty = property
        }

        if (property.type === 'Literal') {
          // spies[0].calls.length
          spyProperty = path.parentPath.value.property
        }

        if (spyProperty) {
          updateSpyProperty(path, spyProperty)
        }
      })
  }

  const checkForUnsupportedFeatures = () =>
    ast
      .find(j.MemberExpression, {
        object: {
          name: expectFunctionName,
        },
        property: {
          name: (name) => unsupportedExpectProperties.has(name),
        },
      })
      .forEach((path) => {
        logWarning(`"${path.value.property.name}" is currently not supported`, path)
      })

  splitChainedMatchers()
  updateMatchers()
  updateSpies()
  checkForUnsupportedFeatures()

  return finale(fileInfo, j, ast, options, expectFunctionName)
}
