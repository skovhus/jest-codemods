import {
  chainContainsUtil,
  createCallChainUtil,
  createCallUtil,
  getExpectNodeUtil,
  getNodeBeforeMemberExpressionUtil,
  updateExpectUtil,
} from '../utils/chai-chain-utils'
import finale from '../utils/finale'
import { getRequireOrImportName, removeRequireAndImport } from '../utils/imports'
import logger from '../utils/logger'
import { findParentOfType, traverseMemberExpressionUtil } from '../utils/recast-helpers'

function addCommentHelper(node, comment) {
  const comments = node.comments || (node.comments = [])
  comments.push(comment)
}

function addLeadingComment(node, comment) {
  comment.leading = true
  comment.trailing = false
  addCommentHelper(node, comment)
}

const fns = [
  'keys',
  'a',
  'an',
  'instanceof',
  'lengthof',
  'length',
  'equal',
  'equals',
  'throw',
  'include',
  'includes',
  'contain',
  'contains',
  'eql',
  'eq',
  'above',
  'gt',
  'greaterthan',
  'least',
  'below',
  'lessthan',
  'lt',
  'most',
  'match',
  'string',
  'members',
  'property',
  'ownproperty',
  'ownpropertydescriptor',
  'gte',
  'lte',
  'within',
]

const members = [
  'ok',
  'true',
  'false',
  'extensible',
  'finite',
  'function',
  'frozen',
  'sealed',
  'null',
  'undefined',
  'exist',
  'empty',
  'nan',
  'defined',
]

const unsupportedProperties = new Set([
  'arguments',
  'respondTo',
  'satisfy',
  'closeTo',
  'oneOf',
  'change',
  'increase',
  'decrease',
])

const mapValueNameToObjectMethod = {
  extensible: 'isExtensible',
  frozen: 'isFrozen',
  sealed: 'isSealed',
}

const typeEqualityToConstructor = {
  regexp: 'RegExp',
  promise: 'Promise',
  date: 'Date',
  set: 'Set',
  map: 'Map',
  weakset: 'WeakSet',
  weakmap: 'WeakMap',
  dataview: 'DataView',
  object: 'Object',
  float64array: 'Float64Array',
  float32array: 'Float32Array',
  uint32array: 'Uint32Array',
  uint16array: 'Uint16Array',
  uint8array: 'Uint8Array',
  int32array: 'Int32Array',
  int16array: 'Int16Array',
  int8array: 'Int8Array',
  uint8clampedarray: 'Uint8ClampedArray',
}

export const assertPrefixes = new Set(['to', 'with', 'that'])

export default function transformer(fileInfo, api, options) {
  const j = api.jscodeshift
  const root = j(fileInfo.source)
  let mutations = 0

  const createCall = createCallUtil(j)
  const chainContains = chainContainsUtil(j)
  const getAllBefore = getNodeBeforeMemberExpressionUtil(j)
  const getExpectNode = getExpectNodeUtil(j)
  const updateExpect = updateExpectUtil(j)
  const createCallChain = createCallChainUtil(j)

  const isShouldMemberExpression = traverseMemberExpressionUtil(
    j,
    (node) => node.type === 'Identifier' && node.name === 'should'
  )

  const isExpectMemberExpression = traverseMemberExpressionUtil(
    j,
    (node) => node.type === j.CallExpression.name && node.callee.name === 'expect'
  )

  const logWarning = (msg, node) => logger(fileInfo, msg, node)

  const chai = getRequireOrImportName(j, root, 'chai')

  const chaiExtensionUsage = root.find(j.CallExpression, {
    callee: {
      object: (node) => node.type === 'Identifier' && node.name === chai,
      property: (node) => node.type === 'Identifier' && node.name === 'use',
    },
  })

  if (chaiExtensionUsage.length > 0) {
    chaiExtensionUsage.forEach((node) => {
      logWarning('Unsupported Chai Extension "chai.use()"', node)
    })
    return
  }

  const chaiExpectRemoved = removeRequireAndImport(j, root, 'chai', 'expect')
  const chaiShouldRemoved = removeRequireAndImport(j, root, 'chai', 'should')
  if (chaiExpectRemoved || chaiShouldRemoved) {
    mutations += 1
  }

  const isExpectCall = (node) =>
    node.name === 'expect' ||
    (node.type === j.MemberExpression.name && isExpectCall(node.object)) ||
    (node.type === j.CallExpression.name && isExpectCall(node.callee))

  const typeOf = (path, value, args, containsNot) => {
    switch (args[0].value) {
      case 'null':
        return createCall(
          'toBeNull',
          [],
          updateExpect(value, (node) => node)
        )
      case 'undefined':
        return createCall(
          'toBeUndefined',
          [],
          updateExpect(value, (node) => node)
        )
      case 'array': {
        const parentExpressionStatement = findParentOfType(path, 'ExpressionStatement')
        if (
          parentExpressionStatement &&
          parentExpressionStatement.value &&
          parentExpressionStatement.value.expression &&
          parentExpressionStatement.value.expression.property &&
          parentExpressionStatement.value.expression.property.name === 'empty'
        ) {
          const topExpression = parentExpressionStatement.value.expression

          const newCallExpression = j.callExpression(j.identifier('toEqual'), [
            j.arrayExpression([]),
          ])
          topExpression.property = containsNot
            ? j.memberExpression(j.identifier('not'), newCallExpression)
            : newCallExpression

          topExpression.object = updateExpect(value, (node) => node)

          return null
        }

        return createCall(
          'toBe',
          [j.booleanLiteral(containsNot ? false : true)],
          updateExpect(value, (node) =>
            j.callExpression(
              j.memberExpression(j.identifier('Array'), j.identifier('isArray')),
              [node]
            )
          )
        )
      }
      case 'string':
        return createCall(
          'toBe',
          args,
          updateExpect(value, (node) => j.unaryExpression('typeof', node)),
          containsNot
        )
      default: {
        const chaiValue = args[0].value

        // Chai type strings are case insensitive. :/ Let us try to guess a constructor.
        const constructor =
          typeEqualityToConstructor[chaiValue.toLowerCase()] ||
          `${chaiValue[0].toUpperCase()}${chaiValue.slice(1)}`

        return createCall(
          'toBeInstanceOf',
          [j.identifier(constructor)],
          updateExpect(value, (node) => node),
          containsNot
        )
      }
    }
  }

  // TODO: not sure if this is even required for chai...
  // E.g. is should(x).true valid?
  const isPrefix = (name) => assertPrefixes.has(name)

  function parseArgs(args) {
    if (args.length === 1 && args[0].type === j.ObjectExpression.name) {
      return [createCallChain(['Object', 'keys'], args)]
    } else if (args.length > 1) {
      return [j.arrayExpression(args)]
    }

    return args
  }

  function containing(node) {
    switch (node.type) {
      case j.ArrayExpression.name:
        return createCallChain(['expect', 'arrayContaining'], [node])
      case j.ObjectExpression.name:
        return createCallChain(['expect', 'objectContaining'], [node])
      default:
        return node
    }
  }

  const createLeadingComments = (rest) => (comment) => {
    if (comment.type === 'Literal') {
      addLeadingComment(rest, j.commentLine(` ${comment.value}`))
      return
    }

    if (comment.type === 'TemplateLiteral') {
      addLeadingComment(
        rest,
        j.commentLine(` ${j(comment).toSource().replace(/`/g, '')}`)
      )
      return
    }

    addLeadingComment(rest, j.commentLine(` ${j(comment).toSource()}`))
  }

  function getRestWithLengthHandled(p, rest) {
    const containsLength = chainContains('length', p.value.callee, isPrefix)
    const newRest = containsLength
      ? updateExpect(rest, (node) => j.memberExpression(node, j.identifier('length')))
      : rest
    if (newRest.arguments) {
      // Add expect's second argument as a comment (if one exists)
      const comments = newRest.arguments.slice(1, 2)
      comments.forEach(createLeadingComments(newRest))

      // Jest's expect only allows one argument
      newRest.arguments = newRest.arguments.slice(0, 1)
    }
    return newRest
  }

  function withIn(p, rest, args, containsNot) {
    if (args.length < 2) {
      logWarning(`.within needs at least two arguments`, p)
      return p.value
    }

    j(p)
      .closest(j.ExpressionStatement)
      .insertBefore(
        j.expressionStatement(
          createCall('toBeGreaterThanOrEqual', [args[0]], rest, containsNot)
        )
      )

    return createCall('toBeLessThanOrEqual', [args[1]], rest, containsNot)
  }

  const shouldChainedToExpect = () =>
    root
      .find(j.MemberExpression, {
        property: {
          type: j.Identifier.name,
          name: 'should',
        },
      })
      .filter((p) => p.node.object)
      .replaceWith((p) => j.callExpression(j.identifier('expect'), [p.node.object]))
      .size()

  const shouldIdentifierToExpect = () =>
    root
      .find(j.CallExpression)
      .filter((p) => isShouldMemberExpression(p.value.callee))
      .replaceWith((p) => {
        const { callee } = p.value
        const [args0, args1] = p.node.arguments

        const assertionNode = j.identifier(callee.property.name)
        const assertionPrefixNode = callee.object.property
        const firstChainElement = assertionPrefixNode || assertionNode

        let memberExpression = j.memberExpression(
          j.callExpression(j.identifier('expect'), [args0]),
          firstChainElement
        )

        if (assertionPrefixNode) {
          // if there is a .not wrap it in another memberExpression
          memberExpression = j.memberExpression(memberExpression, assertionNode)
        }

        if (typeof args1 === 'undefined') {
          return memberExpression
        }

        return j.callExpression(memberExpression, [args1])
      })
      .size()

  const updateMemberExpressions = () => {
    const getMembers = () =>
      root
        .find(j.MemberExpression, {
          property: {
            name: (name) => members.indexOf(name.toLowerCase()) !== -1,
          },
        })
        .filter((p) => findParentOfType(p, 'ExpressionStatement'))
        .filter((p) => {
          const { value } = p
          const propertyName = value.property.name.toLowerCase()

          // Reject "ok" when it isn't  proceeded by "to"
          return !(propertyName === 'ok' && !chainContains('to', value, 'to'))
        })

    getMembers().forEach((p) => {
      if (p.parentPath.value.type === j.CallExpression.name) {
        p.parentPath.replace(p.value)
      }
    })

    return getMembers()
      .replaceWith((p) => {
        const { value } = p
        const rest = getAllBefore(isPrefix, value, 'should')

        if (rest.arguments !== undefined) {
          // Add expect's second argument as a comment (if one exists)
          const comments = rest.arguments.slice(1, 2)
          comments.forEach(createLeadingComments(rest))

          // Jest's expect only allows one argument
          rest.arguments = rest.arguments.slice(0, 1)
        }

        const containsNot = chainContains('not', value, 'to')

        const propertyName = value.property.name.toLowerCase()

        switch (propertyName) {
          case 'ok':
            return containsNot
              ? createCall('toBeFalsy', [], rest)
              : createCall('toBeTruthy', [], rest)
          case 'true':
            return createCall('toBe', [j.booleanLiteral(true)], rest, containsNot)
          case 'false':
            return createCall('toBe', [j.booleanLiteral(false)], rest, containsNot)
          case 'finite':
            return createCall(
              'toBe',
              [j.booleanLiteral(!containsNot)],
              updateExpect(value, (node) => {
                return createCallChain(['isFinite'], [node])
              })
            )
          case 'extensible':
          case 'frozen':
          case 'sealed':
            return createCall(
              'toBe',
              [j.booleanLiteral(!containsNot)],
              updateExpect(value, (node) => {
                return createCallChain(
                  ['Object', mapValueNameToObjectMethod[propertyName]],
                  [node]
                )
              })
            )
          case 'null':
            return createCall('toBeNull', [], rest, containsNot)
          case 'nan':
            return createCall('toBeNaN', [], rest, containsNot)
          case 'undefined':
            return containsNot
              ? createCall('toBeDefined', [], rest)
              : createCall('toBeUndefined', [], rest)
          case 'empty':
            if (
              p.parentPath.parentPath.value.type === 'CallExpression' ||
              !chainContains('be', value, 'to')
            ) {
              return value
            } else {
              return createCall(
                'toHaveLength',
                [j.literal(0)],
                updateExpect(value, (node) => {
                  if (
                    node.type === j.ObjectExpression.name ||
                    node.type === j.Identifier.name
                  ) {
                    return createCallChain(['Object', 'keys'], [node])
                  }

                  if (
                    node.type === j.MemberExpression.name &&
                    node.property.type === 'Identifier' &&
                    node.property.name === 'length'
                  ) {
                    return node.object
                  }

                  return node
                }),
                containsNot
              )
            }

          case 'exist':
          case 'defined': {
            return containsNot
              ? createCall('toBeFalsy', [], rest)
              : createCall('toBeDefined', [], rest)
          }
          case 'function':
            return typeOf(p, value, [j.literal('function')], containsNot)
          default:
            return value
        }
      })
      .size()
  }

  const updateCallExpressions = () =>
    root
      .find(j.CallExpression, {
        callee: {
          type: j.MemberExpression.name,
          property: {
            name: (name) => fns.indexOf(name.toLowerCase()) !== -1,
          },
          object: isExpectCall,
        },
      })
      .replaceWith((p) => {
        const { value } = p

        const restRaw = getAllBefore(isPrefix, value.callee, 'should')
        const rest = getRestWithLengthHandled(p, restRaw)
        const containsNot = chainContains('not', value.callee, isPrefix)
        const containsDeep = chainContains('deep', value.callee, isPrefix)
        const containsAny = chainContains('any', value.callee, isPrefix)
        const args = value.arguments
        const numberOfArgs = args.length
        const [firstArg] = args

        switch (p.value.callee.property.name.toLowerCase()) {
          case 'eq':
          case 'equal':
          case 'equals':
            if (containsDeep) {
              return createCall('toEqual', args, rest, containsNot)
            }

            if (numberOfArgs === 1) {
              const { type } = firstArg

              if (type === 'Literal' && firstArg.value === null) {
                return createCall('toBeNull', [], rest, containsNot)
              }

              if (type === 'Identifier' && firstArg.name === 'undefined') {
                if (containsNot) {
                  return createCall('toBeDefined', [], rest, false)
                } else {
                  return createCall('toBeUndefined', [], rest, false)
                }
              }
            }

            return createCall('toBe', args, rest, containsNot)
          case 'throw':
            return createCall('toThrowError', args, rest, containsNot)
          case 'string':
            return createCall('toContain', args, rest, containsNot)
          case 'include':
          case 'includes':
          case 'contain':
          case 'contains': {
            if (args.length === 1 && args[0].type === j.ObjectExpression.name) {
              return createCall('toMatchObject', args, rest, containsNot)
            }

            const expectNode = getExpectNode(value)
            if (expectNode != null) {
              const isExpectParamStringLiteral =
                expectNode.arguments[0].type === j.Literal.name
              if (isExpectParamStringLiteral) {
                return createCall('toContain', args, rest, containsNot)
              }
            }

            return createCall(
              'toEqual',
              [
                createCallChain(
                  containsNot
                    ? ['expect', 'not', 'arrayContaining']
                    : ['expect', 'arrayContaining'],
                  [j.arrayExpression(args)]
                ),
              ],
              updateExpect(value, (node) => node),
              false
            )
          }
          case 'eql':
            if (numberOfArgs === 1 && args[0].type === 'Literal') {
              return createCall('toBe', args, rest, containsNot)
            } else {
              return createCall('toEqual', args, rest, containsNot)
            }

          case 'above':
          case 'greaterthan':
          case 'gt':
            return createCall('toBeGreaterThan', args, rest, containsNot)
          case 'least':
          case 'gte':
            return createCall('toBeGreaterThanOrEqual', args, rest, containsNot)
          case 'below':
          case 'lessthan':
          case 'lt':
            return createCall('toBeLessThan', args, rest, containsNot)
          case 'most':
          case 'lte':
            return createCall('toBeLessThanOrEqual', args, rest, containsNot)
          case 'within':
            return withIn(p, rest, args, containsNot)
          case 'match':
            return createCall('toMatch', args, rest, containsNot)
          case 'members':
            if (chainContains('ordered', value.callee, isPrefix)) {
              logWarning('Unsupported Chai Assertion "ordered"', p)
            }

            return createCall('toEqual', args.map(containing), rest, containsNot)
          case 'keys':
            if (containsAny) {
              logWarning('Unsupported Chai Assertion "any.keys"', p)
              return value
            }

            return createCall(
              'toEqual',
              [createCallChain(['expect', 'arrayContaining'], parseArgs(args))],
              updateExpect(value, (node) => {
                if (node.type === j.ObjectExpression.name) {
                  return createCallChain(['Object', 'keys'], [node])
                }
                return node
              }),
              containsNot
            )
          case 'a':
          case 'an':
            if (!args.length) {
              return value
            }

            if (args[0].type === 'Literal') {
              return typeOf(p, value, args, containsNot)
            }

            return createCall('toBeInstanceOf', args, rest, containsNot)
          case 'instanceof':
            return createCall('toBeInstanceOf', args, rest, containsNot)
          case 'length':
          case 'lengthof':
            return createCall('toHaveLength', args, restRaw, containsNot)
          case 'property':
            return createCall('toHaveProperty', args, rest, containsNot)
          case 'ownproperty':
            return createCall(
              'toBeTruthy',
              [],
              updateExpect(value, (node) =>
                j.callExpression(
                  j.memberExpression(node, j.identifier('hasOwnProperty')),
                  [args[0]]
                )
              )
            )
          case 'ownpropertydescriptor':
            return args.length === 1
              ? createCall(
                  'toBeUndefined',
                  [],
                  updateExpect(value, (node) =>
                    j.callExpression(
                      j.memberExpression(
                        j.identifier('Object'),
                        j.identifier('getOwnPropertyDescriptor')
                      ),
                      [node, args[0]]
                    )
                  ),
                  true
                )
              : createCall(
                  'toEqual',
                  [args[1]],
                  updateExpect(value, (node) =>
                    j.callExpression(
                      j.memberExpression(
                        j.identifier('Object'),
                        j.identifier('getOwnPropertyDescriptor')
                      ),
                      [node, args[0]]
                    )
                  )
                )
          default:
            return value
        }
      })
      .size()

  mutations += shouldChainedToExpect()
  mutations += shouldIdentifierToExpect()
  mutations += updateCallExpressions()
  mutations += updateMemberExpressions()

  root
    .find(j.MemberExpression, {
      property: {
        name: (name) => unsupportedProperties.has(name),
      },
    })
    .filter((p) => isExpectMemberExpression(p.value))
    .forEach((p) => {
      const assertion = p.value.property.name
      logWarning(`Unsupported Chai Assertion "${assertion}"`, p)
    })

  if (!mutations) {
    return null
  }

  return finale(fileInfo, j, root, options)
}
