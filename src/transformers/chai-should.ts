import {
  chainContainsUtil,
  createCallChainUtil,
  createCallUtil,
  getExpectNodeUtil,
  getNodeBeforeMemberExpressionUtil,
  isExpectCallUtil,
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
  'Uint16Array',
  'Uint32Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'a',
  'above',
  'an',
  'array',
  'below',
  'callCount', // sinon-chai
  'calledWith', // sinon-chai
  'calledWithMatch', // sinon-chai
  'calledWithExactly', // sinon-chai
  'descendants', // chai-enzyme
  'contain',
  'containing',
  'containingAllOf',
  'contains',
  'eq',
  'eql',
  'eqls',
  'equal',
  'equalTo',
  'equals',
  'exactly', // sinon-chai
  'greaterthan',
  'gt',
  'gte',
  'include',
  'includes',
  'instanceof',
  'key',
  'keys',
  'least',
  'length',
  'lengthof',
  'lessthan',
  'lt',
  'lte',
  'match',
  'members',
  'most',
  'ofSize',
  'ownproperty',
  'ownpropertydescriptor',
  'present', // chai-enzyme
  'prop', // chai-enzyme
  'property',
  'props', // chai-enzyme
  'state', // chai-enzyme
  'string',
  'throw',
  'type', // chai-enzyme
  'within',
  // https://www.chaijs.com/plugins/chai-arrays/ plugin:
  // TODO: containingAnyOf
].map((name) => name.toLowerCase())

const members = [
  'called', // sinon-chai
  'calledOnce', // sinon-chai
  'calledThrice', // sinon-chai
  'calledTwice', // sinon-chai
  'defined',
  'empty',
  'exist',
  'extensible',
  'false',
  'finite',
  'frozen',
  'function',
  'nan',
  'null',
  'ok',
  'sealed',
  'true',
  'undefined',
].map((name) => name.toLowerCase())

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

const chaiToJestGlobalMethods = {
  before: 'beforeAll',
  after: 'afterAll',
  context: 'describe',
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

  const isExpectCall = (node) => isExpectCallUtil(j, node)

  const typeOf = (path, value, args, containsNot) => {
    switch (args[0].value) {
      case 'null':
        return createCall(
          'toBeNull',
          [],
          updateExpect(value, (node) => node),
          containsNot
        )
      case 'undefined':
        return createCall(
          'toBeUndefined',
          [],
          updateExpect(value, (node) => node),
          containsNot
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

          // Reject "ok" when it isn't proceeded by "to"
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
            if (propertyName === 'defined' && containsNot) {
              return createCall('toBeDefined', [], rest, true)
            }

            return containsNot
              ? createCall('toBeFalsy', [], rest)
              : createCall('toBeDefined', [], rest)
          }
          case 'function':
            return typeOf(p, value, [j.literal('function')], containsNot)
          case 'called':
            return createCall('toBeCalled', [], rest, containsNot)
          case 'calledonce':
            return createCall('toBeCalledTimes', [j.literal(1)], rest, containsNot)
          case 'calledtwice':
            return createCall('toBeCalledTimes', [j.literal(2)], rest, containsNot)
          case 'calledthrice':
            return createCall('toBeCalledTimes', [j.literal(3)], rest, containsNot)
          default:
            return value
        }
      })
      .size()
  }

  /* 
    reverses `expect().not.to` -> `expect().to.not` to be
    handled correctly by subsequent expression updates
  */
  const reverseNotToExpressions = () => {
    root
      .find(j.MemberExpression, {
        object: {
          object: {
            callee: { name: 'expect' },
          },
          property: { name: 'not' },
        },
        property: { name: 'to' },
      })
      .forEach((np) => {
        np.node.property.name = 'not'
        np.node.object.property.name = 'to'
      })
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
        const containsAny = chainContains('any', value.callee, isPrefix)
        const args = value.arguments
        const numberOfArgs = args.length
        const [firstArg] = args

        const propertyName = value.callee.property.name.toLowerCase()

        switch (propertyName) {
          case 'type':
          case 'descendants': {
            /* 
              if `.not`: expect(wrapper.find(Foo)).toHaveLength(0)
              else if `.exactly`: expect(wrapper.find(Foo)).toHaveLength(exactly.arg[0])
              else: expect(wrapper.find(Foo).length).toBeGreaterThan(0)
            */

            let lengthArg
            if (containsNot) {
              // for .not, it should always be 0
              lengthArg = 0
            } else {
              // if its an `.exactly`, use as length
              let path = value.callee
              // find next call expression
              while (!path.callee) {
                path = path.object
              }
              if (path.callee?.property?.name === 'exactly') {
                lengthArg = path.arguments?.[0]?.value
              }
            }

            const wrapNodeWithFind = (node) =>
              j.callExpression(j.memberExpression(node, j.identifier('find')), args)

            if (lengthArg != null) {
              return createCall(
                'toHaveLength',
                [j.literal(lengthArg)],
                updateExpect(value, wrapNodeWithFind)
              )
            }

            return createCall(
              'toBeGreaterThan',
              [j.literal(0)],
              updateExpect(value, (node) =>
                j.memberExpression(wrapNodeWithFind(node), j.identifier('length'))
              )
            )
          }
          case 'callcount':
            return createCall('toBeCalledTimes', args, rest, containsNot)
          case 'calledwith':
            return createCall('toBeCalledWith', args, rest, containsNot)
          case 'calledwithmatch':
            return createCall('toBeCalledWith', args.map(containing), rest, containsNot)
          case 'calledwithexactly':
            return createCall('toBeCalledWith', args, rest, containsNot)
          case 'exactly':
            // handle `expect(sinonSpy).to.have.called.exactly(3)`
            if (chainContains('called', value.callee, isPrefix)) {
              return createCall('toBeCalledTimes', [firstArg], rest, containsNot)
            }
            return value
          case 'equalto':
          case 'eqls':
          case 'eql':
          case 'eq':
          case 'equal':
          case 'equals': {
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

            const containsDeep = chainContains('deep', value.callee, isPrefix)
            const isStrict = ['equal', 'equals', 'eq'].includes(propertyName)

            return createCall(
              isStrict && !containsDeep ? 'toBe' : 'toEqual',
              args,
              rest,
              containsNot
            )
          }
          case 'throw':
            return createCall('toThrowError', args, rest, containsNot)
          case 'string':
            return createCall('toContain', args, rest, containsNot)
          case 'state':
            return createCall(
              'toHaveProperty',
              args,
              updateExpect(value, (node) =>
                j.callExpression(j.memberExpression(node, j.identifier('state')), [])
              ),
              containsNot
            )
          case 'include':
          case 'includes':
          case 'contain':
          case 'contains': {
            const argType = args[0]?.type
            if (args.length === 1 && argType === j.ObjectExpression.name) {
              return createCall('toMatchObject', args, rest, containsNot)
            }

            const expectNode = getExpectNode(value)
            if (expectNode != null) {
              // handle `expect([1, 2]).toContain(1)
              if (expectNode.arguments[0].type === j.Literal.name) {
                return createCall('toContain', args, rest, containsNot)
              }
              // handle `expect(someArr).toContain(1)`
              if (args.length === 1 && argType === j.Literal.name) {
                return createCall(
                  'toContain',
                  args,
                  updateExpect(value, (node) => node),
                  containsNot
                )
              }
            }

            // handle `expect(wrapper).to.contain(<div />)`
            if (args?.[0]?.type === j.JSXElement.name) {
              return createCall(
                'toEqual',
                [j.identifier('true')],
                updateExpect(value, (node) => {
                  return j.callExpression(
                    j.memberExpression(node, j.identifier('contains')),
                    [args[0]]
                  )
                })
              )
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
          case 'containing':
            return createCall('toContain', args, rest, containsNot)
          case 'containingallof':
            return createCall(
              'toEqual',
              [
                createCallChain(
                  containsNot
                    ? ['expect', 'not', 'arrayContaining']
                    : ['expect', 'arrayContaining'],
                  [j.arrayExpression(args[0].elements)]
                ),
              ],
              updateExpect(value, (node) => node),
              false
            )
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
          case 'key':
            return createCall('toHaveProperty', args, rest, containsNot)
          case 'keys': {
            if (containsAny) {
              logWarning('Unsupported Chai Assertion "any.keys"', p)
              return value
            }

            const updateExpectFn = updateExpect(value, (node) => {
              if (node.type === j.ArrayExpression.name) {
                return node
              }
              return createCallChain(['Object', 'keys'], [node])
            })

            // handle single arguments, eg: `expect(serverConfig).to.have.all.keys('middleware')`
            if (
              args.length === 1 &&
              [j.Literal.name, j.StringLiteral.name, j.Identifier.name].includes(
                args[0].type
              )
            ) {
              return createCall('toContain', args, updateExpectFn, containsNot)
            }

            return createCall(
              'toEqual',
              [createCallChain(['expect', 'arrayContaining'], parseArgs(args))],
              updateExpectFn,
              containsNot
            )
          }
          case 'a':
          case 'an': {
            if (!args.length) {
              return value
            }

            const t = args[0].type
            if (t === 'Literal' || t === 'StringLiteral') {
              return typeOf(p, value, args, containsNot)
            }

            return createCall('toBeInstanceOf', args, rest, containsNot)
          }
          case 'instanceof':
            return createCall('toBeInstanceOf', args, rest, containsNot)
          case 'length':
          case 'lengthof':
          case 'ofsize':
            return createCall('toHaveLength', args, restRaw, containsNot)
          case 'prop':
            return createCall(
              'toHaveProperty',
              args,
              updateExpect(value, (node) =>
                j.callExpression(j.memberExpression(node, j.identifier('props')), [])
              ),
              containsNot
            )
          case 'props':
            if (args[0].type === 'ArrayExpression') {
              return createCall(
                'toEqual',
                [createCallChain(['expect', 'arrayContaining'], args)],
                updateExpect(value, (node) =>
                  createCallChain(
                    ['Object', 'keys'],
                    [
                      j.callExpression(
                        j.memberExpression(node, j.identifier('props')),
                        []
                      ),
                    ]
                  )
                )
              )
            } else if (args[0].type === 'ObjectExpression') {
              return createCall(
                'toMatchObject',
                args,
                updateExpect(value, (node) =>
                  j.callExpression(j.memberExpression(node, j.identifier('props')), [])
                )
              )
            }
            break
          case 'present':
            return createCall(
              'toBeGreaterThan',
              [j.literal(0)],
              updateExpect(value, (node) =>
                j.memberExpression(node, j.identifier('length'))
              ),
              containsNot
            )
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

          case 'array':
          case 'uint8array':
          case 'uint16array':
          case 'uint32array':
          case 'uint8clampedarray':
            return typeOf(p, value, [{ value: propertyName }], containsNot)

          default:
            return value
        }
      })
      .size()

  const updateGlobalCallExpressions = () =>
    root
      .find(j.CallExpression, {
        callee: {
          type: j.Identifier.name,
          name: (name) => Object.keys(chaiToJestGlobalMethods).includes(name),
        },
      })
      .replaceWith((p) => {
        const { value } = p
        return j.callExpression(
          j.identifier(chaiToJestGlobalMethods[value.callee.name]),
          value.arguments
        )
      })
      .size()

  reverseNotToExpressions()
  mutations += shouldChainedToExpect()
  mutations += shouldIdentifierToExpect()
  mutations += updateCallExpressions()
  mutations += updateMemberExpressions()
  mutations += updateGlobalCallExpressions()

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
