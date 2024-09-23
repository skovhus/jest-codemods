import { ExpressionKind } from 'ast-types/gen/kinds'
import core, { API, FileInfo } from 'jscodeshift'

import {
  chainContainsUtil,
  createCallUtil,
  getNodeBeforeMemberExpressionUtil,
  isExpectCallUtil,
} from '../utils/chai-chain-utils'
import finale from '../utils/finale'
import { removeRequireAndImport } from '../utils/imports'
import logger from '../utils/logger'
import { findParentOfType } from '../utils/recast-helpers'
import {
  expressionContainsProperty,
  getExpectArg,
  isExpectSinonCall,
  isExpectSinonObject,
  modifyVariableDeclaration,
} from '../utils/sinon-helpers'

const SINON_CALL_COUNT_METHODS = [
  'called',
  'calledOnce',
  'calledTwice',
  'calledThrice',
  'callCount',
  'notCalled',
]
const CHAI_CHAIN_MATCHERS = new Set(
  [
    'be',
    'eq',
    'eql',
    'equal',
    'equals',
    'toBe',
    'toEqual',
    'toBeTruthy',
    'toBeFalsy',
  ].map((a) => a.toLowerCase())
)
const SINON_CALLED_WITH_METHODS = ['calledWith', 'notCalledWith', 'neverCalledWith']
const SINON_SPY_METHODS = ['spy', 'stub']
const SINON_MOCK_RESETS = {
  reset: 'mockReset',
  resetBehavior: 'mockReset',
  resetHistory: 'mockReset',
  restore: 'mockRestore',
}
const _sinonMockImpls = [
  'returns',
  'returnsArg',
  'resolves',
  'rejects',
  'throws',
  'callsFake',
  'callsArg',
  'callsArgOn',
  'callsArgWith',
  'callsArgOnWith',
] as const
type SinonMockImplementer = (typeof _sinonMockImpls)[number]
const SINON_MOCK_IMPLEMENTERS: Set<SinonMockImplementer> = new Set(_sinonMockImpls)
const SINON_MOCK_IMPLS_TO_JEST = {
  returns: 'mockReturnValue',
  resolves: 'mockResolvedValue',
  rejects: 'mockRejectedValue',
  callsFake: 'mockImplementation',
} as const satisfies Partial<Record<SinonMockImplementer, string>>
const SINON_MATCHERS = {
  array: 'Array',
  func: 'Function',
  number: 'Number',
  object: 'Object',
  string: 'String',
}
const SINON_MATCHERS_WITH_ARGS = {
  array: 'object',
  func: 'function',
  number: 'number',
  object: 'object',
  string: 'string',
}
const SINON_NTH_CALLS = new Set(['firstCall', 'secondCall', 'thirdCall', 'lastCall'])
const SINON_ON_NTH_CALLS = new Set(['onFirstCall', 'onSecondCall', 'onThirdCall'])
const EXPECT_PREFIXES = new Set(['to'])
const isPrefix = (name) => EXPECT_PREFIXES.has(name)

const isTypescript = (parser: string) => parser === 'tsx' || parser === 'ts'

/*
  expect(spy.called).to.be(true) -> expect(spy).toHaveBeenCalled()
  expect(spy.callCount).to.equal(2) -> expect(spy).toHaveBeenCalledTimes(2)
  expect(stub).toHaveProperty('callCount', 1) -> expect(stub).toHaveBeenCalledTimes(1)
*/
function transformCallCountAssertions(j, ast) {
  const chainContains = chainContainsUtil(j)
  const getAllBefore = getNodeBeforeMemberExpressionUtil(j)
  const createCall = createCallUtil(j)

  ast
    .find(j.CallExpression, {
      callee: {
        type: j.MemberExpression.name,
        property: {
          name: (name) => CHAI_CHAIN_MATCHERS.has(name.toLowerCase?.()),
        },
        object: (node) =>
          isExpectSinonObject(node, SINON_CALL_COUNT_METHODS) &&
          isExpectCallUtil(j, node),
      },
    })
    .replaceWith((np) => {
      const { node } = np
      const expectArg = getExpectArg(node.callee)

      // remove .called/.callCount/etc prop from expect argument
      // eg: expect(Api.get.callCount) -> expect(Api.get)
      j(np)
        .find(j.CallExpression, {
          callee: { name: 'expect' },
        })
        .forEach((np) => {
          np.node.arguments = [expectArg.object]
        })

      /*
        handle  `expect(spy.withArgs('foo').called).to.be(true)` ->
                `expect(spy.calledWith(1,2,3)).to.be(true)`
        and let subsequent transform fn take care of converting to
        the final form (ie: see `transformCalledWithAssertions`)
      */
      if (expectArg.object.callee?.property?.name === 'withArgs') {
        // change .withArgs() -> .calledWith()
        expectArg.object.callee.property.name = 'calledWith'
        return node
      }

      const expectArgSinonMethod = expectArg.property.name

      const negated =
        chainContains('not', node.callee, isPrefix) || node.arguments?.[0].value === false // eg: .to.be(false)
      const rest = getAllBefore(isPrefix, node.callee, 'should')

      switch (expectArgSinonMethod) {
        case 'notCalled':
          return createCall('toHaveBeenCalled', [], rest, !negated)
        case 'calledThrice':
          return createCall('toHaveBeenCalledTimes', [j.literal(3)], rest, negated)
        case 'calledTwice':
          return createCall('toHaveBeenCalledTimes', [j.literal(2)], rest, negated)
        case 'calledOnce':
          return createCall('toHaveBeenCalledTimes', [j.literal(1)], rest, negated)
        case 'called':
          return createCall('toHaveBeenCalled', [], rest, negated)
        default:
          // eg: .callCount
          return createCall(
            'toHaveBeenCalledTimes',
            node.arguments.length ? [node.arguments[0]] : [],
            rest,
            negated
          )
      }
    })

  // expect(stub).toHaveProperty('callCount', 1) -> expect(stub).toHaveBeenCalledTimes(1)
  ast
    .find(j.CallExpression, {
      callee: {
        type: j.MemberExpression.name,
        property: {
          name: 'toHaveProperty',
        },
        object: (node) => isExpectCallUtil(j, node),
      },
      arguments: (args) => args?.[0]?.value === 'callCount',
    })
    .replaceWith((np) => {
      const { value } = np
      const newArgs = value.arguments.slice(1)
      value.callee.property.name = 'toHaveBeenCalledTimes'
      value.arguments = newArgs
      return value
    })
}

/*
  expect(spy.calledWith(1, 2, 3)).to.be(true) -> expect(spy).toHaveBeenCalledWith(1, 2, 3);

  https://github.com/jordalgo/jest-codemods/blob/7de97c1d0370c7915cf5e5cc2a860bc5dd96744b/src/transformers/sinon.js#L267
*/
function transformCalledWithAssertions(j, ast) {
  const chainContains = chainContainsUtil(j)
  const getAllBefore = getNodeBeforeMemberExpressionUtil(j)
  const createCall = createCallUtil(j)

  ast
    .find(j.CallExpression, {
      callee: {
        type: j.MemberExpression.name,
        property: {
          name: (name) => CHAI_CHAIN_MATCHERS.has(name.toLowerCase?.()),
        },
        object: (node) =>
          isExpectSinonCall(node, SINON_CALLED_WITH_METHODS) && isExpectCallUtil(j, node),
      },
    })
    .replaceWith((np) => {
      const { node } = np
      const expectArg = getExpectArg(node.callee)

      // remove .calledWith() call from expect argument
      j(np)
        .find(j.CallExpression, {
          callee: { name: 'expect' },
        })
        .forEach((np) => {
          np.node.arguments = [expectArg.callee.object]
        })

      const expectArgSinonMethod = expectArg.callee?.property?.name
      const negated =
        chainContains('not', node.callee, isPrefix) || node.arguments?.[0].value === false // eg: .to.be(false)
      const rest = getAllBefore(isPrefix, node.callee, 'should')

      switch (expectArgSinonMethod) {
        case 'calledWith':
          return createCall('toHaveBeenCalledWith', expectArg.arguments, rest, negated)
        case 'notCalledWith':
          return createCall('toHaveBeenCalledWith', expectArg.arguments, rest, !negated)
        default:
          return node
      }
    })
}

/*
sinon.stub(Api, 'get') -> jest.spyOn(Api, 'get')
*/
function transformStub(j, ast, sinonExpression, logWarning) {
  ast
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: {
          type: 'Identifier',
          name: (name) => SINON_SPY_METHODS.includes(name),
        },
        object: {
          type: 'Identifier',
          name: sinonExpression,
        },
      },
    })
    .replaceWith((np) => {
      // stubbing/spyOn module
      const args = np.value.arguments
      const propertyName = np.node.callee.property.name

      if (args.length === 1 && propertyName === 'stub') {
        logWarning(
          'stubbing all methods in an object is not supported; stub each one you care about individually',
          np
        )
        return np.value
      }

      if (args.length >= 2) {
        let spyOn = j.callExpression(
          j.memberExpression(j.identifier('jest'), j.identifier('spyOn')),
          args.slice(0, 2)
        )

        // add mockClear since jest doesn't reset the stub on re-declaration like sinon does
        spyOn = j.callExpression(j.memberExpression(spyOn, j.identifier('mockClear')), [])

        // add mockImplementation call
        if (args.length >= 3) {
          spyOn = j.callExpression(
            j.memberExpression(spyOn, j.identifier('mockImplementation')),
            [args[2]]
          )

          if (args.length >= 4) {
            logWarning(
              `4+ arguments found in sinon.${propertyName} call; did you mean to use this many?`,
              np
            )
          }
        } else if (propertyName === 'stub') {
          const parent =
            findParentOfType(np, j.VariableDeclaration.name) ||
            findParentOfType(np, j.ExpressionStatement.name)

          const hasMockImpls =
            j(parent)
              .find(j.CallExpression, {
                callee: {
                  type: 'MemberExpression',
                  property: {
                    type: 'Identifier',
                    name: (name) => SINON_MOCK_IMPLEMENTERS.has(name),
                  },
                },
              })
              .size() > 0
          if (!hasMockImpls) {
            spyOn = j.callExpression(
              j.memberExpression(spyOn, j.identifier('mockImplementation')),
              []
            )
          }
        }

        return spyOn
      }

      // jest mock function
      return j.callExpression(j.identifier('jest.fn'), args)
    })
}

function getMockImplReturn(j: core.JSCodeshift, sinonImpl) {
  const sinonMethodName: SinonMockImplementer = sinonImpl.callee.property.name

  if (sinonMethodName.startsWith('callsArg')) {
    /*
      stub.callsArg(0) -> stub.mockImplementation((...args: any[]) => args[0]())
      stub.callsArgOn(1, thisArg) -> stub.mockImplementation((...args: any[]) => args[1].call(thisArg))
      stub.callsArgWith(2, arg1, arg2) -> stub.mockImplementation((...args: any[]) => args[2](arg1, arg2))
      stub.callsArgOnWith(3, thisArg, arg1, arg2) -> stub.mockImplementation((...args: any[]) => args[3].call(thisArg, arg1, arg2))
    */
    if (sinonImpl.arguments.length < 1) return undefined

    const argName = j.memberExpression(j.identifier('args'), sinonImpl.arguments[0], true)
    switch (sinonMethodName) {
      case 'callsArg':
        return j.callExpression(argName, [])
      case 'callsArgOn':
        return j.callExpression(j.memberExpression(argName, j.identifier('call')), [
          sinonImpl.arguments[1],
        ])
      case 'callsArgWith':
        return j.callExpression(argName, sinonImpl.arguments.slice(1))
      case 'callsArgOnWith':
        return j.callExpression(
          j.memberExpression(argName, j.identifier('call')),
          sinonImpl.arguments.slice(1)
        )
    }
  }

  switch (sinonMethodName) {
    case 'returns':
      return sinonImpl.arguments[0] // TODO: should this support void (empty arguments)?
    case 'returnsArg':
      return j.memberExpression(j.identifier('args'), sinonImpl.arguments[0], true)
    case 'resolves':
      return j.callExpression(
        j.memberExpression(j.identifier('Promise'), j.identifier('resolve')),
        sinonImpl.arguments.slice(0, 1)
      )
    case 'rejects':
      return j.callExpression(
        j.memberExpression(j.identifier('Promise'), j.identifier('reject')),
        [sinonImpl.arguments[0]]
      )
    case 'throws':
      return j.throwStatement(sinonImpl.arguments[0])
    case 'callsFake':
      return j.callExpression(sinonImpl.arguments[0], [
        j.spreadElement(j.identifier('args')),
      ])
  }
}

/** gets one of sinon mock implementer (returns/returnsArg/resolves/...) and returns jest equivalent */
function getMockImplReplacement(
  j: core.JSCodeshift,
  sinonImpl,
  parser,
  conditionalExpr?: ExpressionKind
) {
  const sinonMethodName: SinonMockImplementer = sinonImpl.callee.property.name
  const isTypescript = parser === 'ts' || parser === 'tsx'

  if (
    conditionalExpr === undefined &&
    SINON_MOCK_IMPLS_TO_JEST[sinonMethodName] !== undefined
  ) {
    sinonImpl.callee.property.name = SINON_MOCK_IMPLS_TO_JEST[sinonMethodName]
    return sinonImpl
  }

  const implReturn = getMockImplReturn(j, sinonImpl)
  if (implReturn === undefined) {
    return sinonImpl
  }

  const returnIsExpr = j(implReturn).isOfType(j.Expression)
  let returnBody =
    returnIsExpr && conditionalExpr === undefined
      ? implReturn
      : j.blockStatement([returnIsExpr ? j.returnStatement(implReturn) : implReturn])
  if (conditionalExpr !== undefined) {
    returnBody = j.blockStatement([j.ifStatement(conditionalExpr, returnBody)])
  }
  const mockImplementationArgs =
    j(returnBody).find(j.Identifier, { name: 'args' }).size() === 0
      ? []
      : [
          j.spreadPropertyPattern(
            j.identifier.from({
              name: 'args',
              typeAnnotation: isTypescript
                ? j.typeAnnotation(j.arrayTypeAnnotation(j.anyTypeAnnotation()))
                : null,
            })
          ),
        ]
  const mockImplementationFn = j.arrowFunctionExpression(
    mockImplementationArgs,
    returnBody
  )

  if (conditionalExpr === undefined) {
    sinonImpl.callee.property.name = 'mockImplementation'
    sinonImpl.arguments = [mockImplementationFn]
    return sinonImpl
  }
  return j.callExpression(
    j.memberExpression(
      sinonImpl.callee.object.callee.object,
      j.identifier('mockImplementation')
    ),
    [mockImplementationFn]
  )
}

/*
  transform .onCall(0), .on{First,Second,Third}Call()

  stub.onCall(4).return(biscuits) -> stub.mockImplementation(() => { if (stub.mock.calls.length === 3) return biscuits; })
  stub.onFirstCall().returnArg(2) -> stub.mockImplementation((...args: any[]) => { if (stub.mock.calls.length === 0) return args[2]; })
*/
function transformStubOnCalls(j, ast, parser) {
  ast
    .find(j.CallExpression, {
      callee: {
        object: {
          callee: {
            property: {
              name: (n) => n === 'onCall' || SINON_ON_NTH_CALLS.has(n),
            },
          },
        },
        property: {
          name: (n) => SINON_MOCK_IMPLEMENTERS.has(n),
        },
      },
    })
    .replaceWith(({ node }) => {
      let index
      switch (node.callee.object.callee.property.name) {
        case 'onCall':
          index = node.callee.object.arguments[0]
          break
        case 'onFirstCall':
          index = j.numericLiteral(0)
          break
        case 'onSecondCall':
          index = j.numericLiteral(1)
          break
        case 'onThirdCall':
          index = j.numericLiteral(2)
          break
      }
      if (!index) return node

      // `jest.spyOn` or `jest.fn`
      const mockFn = node.callee.object.callee.object
      const callLengthConditionalExpression = j.binaryExpression(
        '===',
        j.memberExpression(mockFn, j.identifier('mock.calls.length')),
        index
      )

      return getMockImplReplacement(j, node, parser, callLengthConditionalExpression)
    })
}

/*
  stub.getCall(0) -> stub.mock.calls[0]
  stub.getCall(0).args[1] -> stub.mock.calls[0][1]
  stub.firstCall|lastCall|thirdCall|secondCall -> stub.mock.calls[n]
*/
function transformStubGetCalls(j: core.JSCodeshift, ast) {
  // transform .getCall
  ast
    .find(j.CallExpression, {
      callee: {
        property: {
          name: (n) => ['getCall', 'getCalls'].includes(n),
        },
      },
    })
    .replaceWith((np) => {
      const { node } = np
      const withMockCall = j.memberExpression(
        j.memberExpression(node.callee.object, j.identifier('mock')),
        j.identifier('calls')
      )
      if (node.callee.property.name === 'getCall') {
        return j.memberExpression(
          withMockCall,
          // ensure is a literal to prevent something like: `calls.0[0]`
          j.literal(node.arguments?.[0]?.value ?? 0)
        )
      }
      return withMockCall
    })

  // transform .nthCall
  ast
    .find(j.MemberExpression, {
      property: {
        name: (name) => SINON_NTH_CALLS.has(name),
      },
    })
    .replaceWith((np) => {
      const { node } = np
      const { name } = node.property

      const createMockCall = (n) => {
        const nth = j.literal(n)
        return j.memberExpression(j.memberExpression(node, j.identifier('calls')), nth)
      }

      node.property.name = 'mock'
      switch (name) {
        case 'firstCall':
          return createMockCall(0)
        case 'secondCall':
          return createMockCall(1)
        case 'thirdCall':
          return createMockCall(2)
        case 'lastCall': {
          return j.memberExpression(node, j.identifier('lastCall'))
        }
      }
      return node
    })

  // transform .args[n] expression
  ast
    // match on .args, not the more specific .args[n]
    .find(j.MemberExpression, {
      property: {
        name: 'args',
      },
    })
    .replaceWith((np) => {
      const { node } = np

      // if contains .mock.calls already, can safely remove .args
      if (
        expressionContainsProperty(node, 'mock') &&
        (expressionContainsProperty(node, 'calls') ||
          expressionContainsProperty(node, 'lastCall'))
      ) {
        return np.node.object
      }

      /*
        replace .args with mock.calls, handles:
        stub.args[0][0] -> stub.mock.calls[0][0]
      */
      return j.memberExpression(np.node.object, j.identifier('mock.calls'))
    })
}

/*
  handles:
    .withArgs
    .returns
    .returnsArg
*/
function transformMock(j: core.JSCodeshift, ast, parser: string) {
  // stub.withArgs(111).returns('foo') => stub.mockImplementation((...args) => { if (args[0] === '111') return 'foo' })
  ast
    .find(j.CallExpression, {
      callee: {
        object: {
          callee: {
            property: {
              name: 'withArgs',
            },
          },
        },
        property: {
          name: (n) => SINON_MOCK_IMPLEMENTERS.has(n),
        },
      },
    })
    .replaceWith((np) => {
      const { node } = np

      // `jest.spyOn` or `jest.fn`
      const mockFn = node.callee.object.callee.object
      const mockImplementationArgs = node.callee.object.arguments
      const mockImplementationReturn = node.arguments

      // unsupported/untransformable .withArgs, just remove .withArgs from chain
      if (!mockImplementationArgs?.length || !mockImplementationReturn?.length) {
        node.callee = j.memberExpression(mockFn, node.callee.property)
        return node
      }

      const isSinonMatcherArg = (arg) =>
        arg.type === 'MemberExpression' &&
        arg.object?.object?.name === 'sinon' &&
        arg.object?.property?.name === 'match'

      // generate conditional expression to match args used in .mockImplementation
      const mockImplementationConditionalExpression = (mockImplementationArgs as any[])
        .map((arg, i) => {
          const argName = j.memberExpression(j.identifier('args'), j.literal(i), true)
          // handle sinon matchers
          if (isSinonMatcherArg(arg)) {
            const matcherType = SINON_MATCHERS_WITH_ARGS[arg.property.name]
            // `sinon.match.object` -> `typeof args[0] === 'object'`
            if (matcherType) {
              return j.binaryExpression(
                '===',
                j.unaryExpression('typeof', argName),
                j.stringLiteral(matcherType)
              )
            }
            // handle `sinon.match.any` - check for total number of args, eg: `args.length >= ${expectedArgs}
            return j.binaryExpression(
              '>=',
              j.memberExpression(j.identifier('args'), j.identifier('length')),
              j.literal(mockImplementationArgs.length)
            )
          }
          return j.binaryExpression('===', argName, arg)
        })
        .reduce((logicalExp: any, binExp: any, i) => {
          if (i === 0) {
            return binExp
          }
          return j.logicalExpression('&&', logicalExp, binExp)
        })

      return getMockImplReplacement(
        j,
        node,
        parser,
        mockImplementationConditionalExpression
      )
    })

  // any remaining sinon mock impl (returns, returnsArg, etc.)
  ast
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: {
          name: (n) => SINON_MOCK_IMPLEMENTERS.has(n),
        },
      },
    })
    .replaceWith(({ node }) => getMockImplReplacement(j, node, parser))
}

/*
  handles mock resets/clears/etc:
  sinon.restore() -> jest.restoreAllMocks()
  stub.restore() -> stub.mockRestore()
  stub.reset() -> stub.mockReset()
*/
function transformMockResets(j, ast) {
  ast
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: {
          type: 'Identifier',
          name: 'sinon',
        },
        property: {
          type: 'Identifier',
          name: 'restore',
        },
      },
    })
    .forEach((np) => {
      np.node.callee.object.name = 'jest'
      np.node.callee.property.name = 'restoreAllMocks'
    })

  ast
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: {
          type: 'Identifier',
          name: (name) => Object.hasOwn(SINON_MOCK_RESETS, name),
        },
      },
    })
    .forEach((np) => {
      const name = SINON_MOCK_RESETS[np.node.callee.property.name]
      np.node.callee.property.name = name
    })
}

/*
  sinon.assert.called(spy) -> expect(spy).toHaveBeenCalled()
  sinon.assert.calledOnce(spy) -> expect(spy).toHaveBeenCalledTimes(1)
  sinon.assert.calledWith(spy, arg1, arg2) -> expect(spy).toHaveBeenCalledWith(arg1, arg2)
*/
function transformAssert(j, ast) {
  ast
    .find(j.CallExpression, {
      type: 'CallExpression',
      callee: {
        type: 'MemberExpression',
        object: {
          type: 'MemberExpression',
          object: {
            type: 'Identifier',
            name: 'sinon',
          },
          property: {
            type: 'Identifier',
            name: 'assert',
          },
        },
        property: {
          type: 'Identifier',
          name: (n) =>
            SINON_CALL_COUNT_METHODS.includes(n) || SINON_CALLED_WITH_METHODS.includes(n),
        },
      },
    })
    .replaceWith((np) => {
      const args = np.node.arguments
      const { name } = np.node.callee.property

      let matcher

      switch (name) {
        case 'called':
          matcher = j.callExpression(j.identifier('toHaveBeenCalled'), [])
          break
        case 'notCalled':
          matcher = j.callExpression(
            j.memberExpression(j.identifier('not'), j.identifier('toHaveBeenCalled')),
            []
          )
          break
        case 'calledOnce':
          matcher = j.callExpression(j.identifier('toHaveBeenCalledTimes'), [
            j.numericLiteral(1),
          ])
          break
        case 'calledTwice':
          matcher = j.callExpression(j.identifier('toHaveBeenCalledTimes'), [
            j.numericLiteral(2),
          ])
          break
        case 'calledThrice':
          matcher = j.callExpression(j.identifier('toHaveBeenCalledTimes'), [
            j.numericLiteral(3),
          ])
          break
        case 'callCount':
          matcher = j.callExpression(j.identifier('toHaveBeenCalledTimes'), [args[1]])
          break
        case 'calledWith':
          matcher = j.callExpression(j.identifier('toHaveBeenCalledWith'), args.slice(1))
          break
        case 'neverCalledWith':
          matcher = j.callExpression(
            j.memberExpression(j.identifier('not'), j.identifier('toHaveBeenCalledWith')),
            args.slice(1)
          )
          break
      }

      return j.memberExpression(
        j.callExpression(j.identifier('expect'), [args[0]]),
        matcher
      )
    })
}

/*
  sinon.match({ ... }) -> expect.objectContaining({ ... })
  // .any. matches:
  sinon.match.[any|number|string|object|func|array] -> expect.any(type)
*/
function transformMatch(j, ast) {
  ast
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: {
          type: 'Identifier',
          name: 'sinon',
        },
        property: {
          type: 'Identifier',
          name: 'match',
        },
      },
    })
    .replaceWith((np) => {
      const args = np.node.arguments
      return j.callExpression(j.identifier('expect.objectContaining'), args)
    })

  ast
    .find(j.MemberExpression, {
      type: 'MemberExpression',
      object: {
        object: {
          name: 'sinon',
        },
        property: {
          name: 'match',
        },
      },
    })
    .replaceWith((np) => {
      const { name } = np.node.property
      const constructorType = SINON_MATCHERS[name]
      if (constructorType) {
        return j.callExpression(j.identifier('expect.any'), [
          j.identifier(constructorType),
        ])
      }
      return j.callExpression(j.identifier('expect.anything'), [])
    })
}

function transformMockTimers(j, ast) {
  // sinon.useFakeTimers() -> jest.useFakeTimers()
  // sinon.useFakeTimers(new Date(...)) -> jest.useFakeTimers().setSystemTime(new Date(...))
  ast
    .find(j.CallExpression, {
      callee: {
        object: {
          name: 'sinon',
        },
        property: {
          name: 'useFakeTimers',
        },
      },
    })
    .forEach((np) => {
      let { node } = np
      node.callee.object.name = 'jest'

      // handle real system time
      if (node.arguments?.length) {
        const args = node.arguments
        node.arguments = []
        node = j.callExpression(
          j.memberExpression(node, j.identifier('setSystemTime')),
          args
        )
      }

      // if `const clock = sinon.useFakeTimers()`, remove variable dec
      const parentAssignment =
        findParentOfType(np, j.VariableDeclaration.name) ||
        findParentOfType(np, j.AssignmentExpression.name)

      if (parentAssignment) {
        // clock = sinon.useFakeTimers()
        if (parentAssignment.value?.type === j.AssignmentExpression.name) {
          const varName = parentAssignment.value.left?.name

          // clock = sinon.useFakeTimers() -> sinon.useFakeTimers()
          parentAssignment.parentPath.value.expression = node

          // remove global variable declaration
          const varNp = np.scope.lookup(varName)?.getBindings()?.[varName]?.[0]
          if (varNp) {
            modifyVariableDeclaration(varNp, null)
          }

          // const clock = sinon.useFakeTimers() -> sinon.useFakeTimers()
        } else if (parentAssignment.parentPath.name === 'body') {
          modifyVariableDeclaration(np, j.expressionStatement(node))
        }
      }
    })

  // clock.tick(n) -> jest.advanceTimersByTime(n)
  ast
    .find(j.CallExpression, {
      callee: {
        object: {
          type: 'Identifier',
        },
        property: {
          name: 'tick',
        },
      },
    })
    .forEach((np) => {
      const { node } = np
      node.callee.object.name = 'jest'
      node.callee.property.name = 'advanceTimersByTime'
    })

  /*
    `stub.restore` shares the same property name as `sinon.useFakeTimers().restore`
    so only transform those with `clock` object which seems to be the common name used
    for mock timers throughout our codebase
  */
  // clock.restore() -> jest.useRealTimers()
  ast
    .find(j.CallExpression, {
      callee: {
        object: {
          name: 'clock',
        },
        property: {
          name: 'restore',
        },
      },
    })
    .forEach((np) => {
      const { node } = np
      node.callee.object.name = 'jest'
      node.callee.property.name = 'useRealTimers'
    })
}

// let stub: sinon.SinonStub -> let stub: jest.Mock
// let spy: sinon.SinonSpy -> let spy: jest.SpyInstance
function transformTypes(j, ast, parser) {
  if (!isTypescript(parser)) return

  ast
    .find(j.TSTypeReference, {
      typeName: {
        left: {
          name: 'sinon',
        },
        right: {
          name: 'SinonStub',
        },
      },
    })
    .forEach((np) => {
      np.node.typeName.left.name = 'jest'
      np.node.typeName.right.name = 'Mock'
    })

  ast
    .find(j.TSTypeReference, {
      typeName: {
        left: {
          name: 'sinon',
        },
        right: {
          name: 'SinonSpy',
        },
      },
    })
    .forEach((np) => {
      np.node.typeName.left.name = 'jest'
      np.node.typeName.right.name = 'SpyInstance'
    })
}

export default function transformer(fileInfo: FileInfo, api: API, options) {
  const j = api.jscodeshift
  const ast = j(fileInfo.source)

  const sinonExpression =
    removeRequireAndImport(j, ast, 'sinon-sandbox') ||
    removeRequireAndImport(j, ast, 'sinon')

  if (!sinonExpression) {
    if (!options.skipImportDetection) {
      return fileInfo.source
    }
    return null
  }

  const logWarning = (msg, node) => logger(fileInfo, msg, node)

  transformStub(j, ast, sinonExpression, logWarning)
  transformStubOnCalls(j, ast, options.parser)
  transformMockTimers(j, ast)
  transformMock(j, ast, options.parser)
  transformMockResets(j, ast)
  transformCallCountAssertions(j, ast)
  transformCalledWithAssertions(j, ast)
  transformAssert(j, ast)
  transformMatch(j, ast)
  transformStubGetCalls(j, ast)
  transformTypes(j, ast, options.parser)

  return finale(fileInfo, j, ast, options)
}
