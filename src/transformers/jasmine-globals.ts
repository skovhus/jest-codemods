/**
 * Codemod for transforming Jasmine globals into Jest.
 */
import { ObjectProperty } from 'jscodeshift'

import finale from '../utils/finale'
import logger from '../utils/logger'

export default function jasmineGlobals(fileInfo, api, options) {
  const j = api.jscodeshift
  const root = j(fileInfo.source)

  const emptyArrowFn = j('() => {}').__paths[0].value.program.body[0].expression

  const logWarning = (msg, path) => logger(fileInfo, msg, path)

  root
    .find(j.CallExpression, {
      // find `jasmine.createSpy(*).and.*()` expressions
      callee: {
        type: 'MemberExpression',
        object: {
          type: 'MemberExpression',
          property: { name: 'and' },
          object: {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              property: {
                type: 'Identifier',
                name: 'createSpy',
              },
              object: {
                type: 'Identifier',
                name: 'jasmine',
              },
            },
          },
        },
      },
    })
    .forEach((path) => {
      const spyType = path.node.callee.property.name
      switch (spyType) {
        // `jasmine.createSpy().and.callFake(*)` is equivalent of
        // `jest.fn(*)`
        case 'callFake': {
          path.node.callee = j.memberExpression(j.identifier('jest'), j.identifier('fn'))
          break
        }
        // `jasmine.createSpy().and.returnValue(*)` is equivalent of
        // `jest.fn(() => *)`
        case 'returnValue': {
          path.node.callee = j.memberExpression(j.identifier('jest'), j.identifier('fn'))
          path.node.arguments = [j.arrowFunctionExpression([], path.node.arguments[0])]
          break
        }
        // This is transformed by the *.and.*() expression handling below
        case 'resolveTo': {
          break
        }
        // This is transformed by the *.and.*() expression handling below
        case 'rejectWith': {
          break
        }
        default: {
          logWarning(
            `Unsupported Jasmine functionality "jasmine.createSpy().and.${spyType}".`,
            path
          )
          break
        }
      }
    })

  root
    .find(j.CallExpression, {
      // find all `*.and.returnValue()`
      callee: {
        type: 'MemberExpression',
        property: { type: 'Identifier', name: 'returnValue' },
        object: {
          type: 'MemberExpression',
          property: { type: 'Identifier', name: 'and' },
        },
      },
    })
    .forEach((path) => {
      // Rename mock function
      path.node.callee.property.name = 'mockReturnValue'
      // Remove '.and.' in between
      path.node.callee.object = path.node.callee.object.object
    })

  root
    .find(j.CallExpression, {
      // find all other `jasmine.createSpy` calls
      callee: {
        type: 'MemberExpression',
        property: {
          type: 'Identifier',
          name: 'createSpy',
        },
        object: {
          type: 'Identifier',
          name: 'jasmine',
        },
      },
    })
    .forEach((path) => {
      // make it `jest.fn()`
      path.node.callee = j.memberExpression(j.identifier('jest'), j.identifier('fn'))
      path.node.arguments = []
    })

  root // find all global `spyOn` calls that are standalone expressions.
    // e.g.
    // spyOn(stuff)
    // but not
    // spyOn(stuff).and.callThrough();
    .find(j.ExpressionStatement, {
      expression: {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'spyOn',
        },
      },
    })
    .forEach((path) => {
      path.node.expression = j.callExpression(
        j.memberExpression(
          path.node.expression, // add .mockImplementation(() => {}); call
          // because jasmine spy's default is to mock the return value,
          // whereas jest calls through by default.
          j.identifier('mockImplementation')
        ),
        [emptyArrowFn]
      )
    })

  root
    .find(j.CallExpression, {
      // find *.and.*() expressions, e.g.
      // - `spyOn().and.callThrough()`,
      // - `spyOn().and.callFake(..)`
      // - `existingSpy.and.callFake(..)`
      // - `spyOn().and.returnValue(..)`
      // - `existingSpy.and.returnValue(..)`
      // - `spyOn().and.resolveTo(..)`
      // - `existingSpy.and.rejectWith(..)`
      callee: {
        type: 'MemberExpression',
        object: {
          type: 'MemberExpression',
          property: { name: 'and' },
        },
      },
    })
    .forEach((path) => {
      const spyType = path.node.callee.property.name
      switch (spyType) {
        // if it's `*.and.callThrough()` we should remove
        // `and.callThrough()` because jest calls through by default
        case 'callThrough': {
          // if this comes from an `Identifier` (e.g. `existingSpy.and.callThrough()`),
          // we assume the intent is to restore an existing spy
          // to its original implementation using `*.mockRestore()`
          if (path.node.callee.object.object.type === 'Identifier') {
            path.node.callee.object = path.node.callee.object.object
            path.node.callee.property.name = 'mockRestore'
          } else {
            // otherwise, we just remove the `.and.callThrough()`
            // since this is the default behavior in jest
            j(path).replaceWith(path.node.callee.object.object)
          }
          break
        }
        // if it's `*.and.callFake()`, replace with jest's
        // equivalent `*.mockImplementation();
        case 'callFake': {
          path.node.callee.object = path.node.callee.object.object
          path.node.callee.property.name = 'mockImplementation'
          break
        }
        // `*.and.returnValue()` is equivalent of jest
        // `*.mockReturnValue()`
        case 'returnValue': {
          path.node.callee.object = path.node.callee.object.object
          path.node.callee.property.name = 'mockReturnValue'
          break
        }

        case 'returnValues': {
          let mockReturnValuesCall = j.callExpression(
            j.memberExpression(j.identifier('jest'), j.identifier('spyOn')),
            path.node.callee.object.object.arguments ?? []
          )

          for (const argument of path.node.arguments) {
            mockReturnValuesCall = j.callExpression(
              j.memberExpression(mockReturnValuesCall, j.identifier('mockReturnValue')),
              [argument]
            )
          }

          j(path).replaceWith(mockReturnValuesCall)
          break
        }
        // `*.and.resolveTo()` is equivalent of jest
        // `*.mockResolvedValue()`
        case 'resolveTo': {
          path.node.callee.object = path.node.callee.object.object
          path.node.callee.property.name = 'mockResolvedValue'
          break
        }
        // `*.and.rejectWith()` is equivalent of jest
        // `*.mockRejectedValue()`
        case 'rejectWith': {
          path.node.callee.object = path.node.callee.object.object
          path.node.callee.property.name = 'mockRejectedValue'
          break
        }
      }
    })

  root
    .find(j.CallExpression, {
      //   find all `spyOn` calls
      callee: { type: 'Identifier', name: 'spyOn' },
    })
    .forEach((path) => {
      // and make them `jest.spyOn()`
      path.node.callee = j.memberExpression(j.identifier('jest'), j.identifier('spyOn'))
    })

  root
    .find(j.CallExpression, {
      callee: { type: 'Identifier', name: 'spyOnProperty' },
    })
    .forEach((path) => {
      path.node.callee = j.memberExpression(j.identifier('jest'), j.identifier('spyOn'))

      // explicitly add third parameter, which is defaulted as 'get' in jasmine
      if (path.node.arguments.length === 2) {
        path.node.arguments.push(j.literal('get'))
      }
    })

  root
    .find(j.CallExpression, {
      // find all `*.calls.count()`
      callee: {
        type: 'MemberExpression',
        property: { type: 'Identifier', name: 'count' },
        object: {
          type: 'MemberExpression',
          property: { type: 'Identifier', name: 'calls' },
        },
      },
    })
    .forEach((path) => {
      // replace `.count()` with `.length`
      path.node.callee.property.name = 'length'
      // add extra `.mock` property that jest uses:
      //   stuff.calls.count() -> stuff.mock.calls.length
      path.node.callee.object.object = j.memberExpression(
        path.node.callee.object.object,
        j.identifier('mock')
      )
      j(path).replaceWith(path.node.callee)
    })

  root
    .find(j.CallExpression, {
      // find all `*.calls.reset()`
      callee: {
        type: 'MemberExpression',
        property: { type: 'Identifier', name: 'reset' },
        object: {
          type: 'MemberExpression',
          property: { type: 'Identifier', name: 'calls' },
        },
      },
    })
    .forEach((path) => {
      j(path).replaceWith(
        j.callExpression(
          j.memberExpression(path.node.callee.object.object, j.identifier('mockReset')),
          []
        )
      )
    })

  root
    .find(j.MemberExpression, {
      // find all `stuff.callCount`
      property: {
        type: 'Identifier',
        name: 'callCount',
      },
    })
    .forEach((path) => {
      // and make them `stuff.mock.calls.length`
      path.node.property.name = 'length'
      path.node.object = j.memberExpression(path.node.object, j.identifier('mock'))
      path.node.object = j.memberExpression(path.node.object, j.identifier('calls'))
    })

  root
    .find(j.MemberExpression, {
      // find `stuff.mostRecentCall`
      property: {
        type: 'Identifier',
        name: 'mostRecentCall',
      },
    })
    .forEach((path) => {
      // turn it into `stuff.mock.calls[stuff.mock.calls.length - 1]`
      path.node.object = j.memberExpression(path.node.object, j.identifier('mock'))
      path.node.object = j.memberExpression(path.node.object, j.identifier('calls'))
      path.node.property = j.binaryExpression(
        '-',
        j.memberExpression(path.node.object, j.identifier('length')),
        j.literal(1)
      )
      path.node.computed = true
    })

  root
    .find(j.CallExpression, {
      // find `*.calls.mostRecent()`
      callee: {
        type: 'MemberExpression',
        object: {
          type: 'MemberExpression',
          property: {
            type: 'Identifier',
            name: 'calls',
          },
        },
        property: {
          type: 'Identifier',
          name: 'mostRecent',
        },
      },
    })
    .forEach((path) => {
      const expressionMockCalls = j.memberExpression(
        j.memberExpression(path.node.callee.object.object, j.identifier('mock')),
        j.identifier('calls')
      )

      // turn it into `*.mock.calls[*.mock.calls.length - 1]`
      j(path).replaceWith(
        j.memberExpression(
          expressionMockCalls,
          j.binaryExpression(
            '-',
            j.memberExpression(expressionMockCalls, j.identifier('length')),
            j.literal(1)
          ),
          true
        )
      )
    })

  root
    .find(j.CallExpression, {
      // find `*.calls.allArgs()`
      callee: {
        type: 'MemberExpression',
        object: {
          type: 'MemberExpression',
          property: {
            type: 'Identifier',
            name: 'calls',
          },
        },
        property: {
          type: 'Identifier',
          name: 'allArgs',
        },
      },
    })
    .forEach((path) => {
      j(path).replaceWith(
        j.memberExpression(
          j.memberExpression(path.node.callee.object.object, j.identifier('mock')),
          j.identifier('calls')
        )
      )
    })

  root // find anything that accesses property on `args`
    // like `stuff.mostRecentCall.args[0]`
    .find(j.MemberExpression, {
      object: {
        type: 'MemberExpression',
        property: {
          type: 'Identifier',
          name: 'args',
        },
      },
    })
    .forEach((path) => {
      // remove args, since jest calls are array of arrays
      // `stuff.mostRecentCall[0]`
      path.node.object.object && (path.node.object = path.node.object.object)
    })

  root
    .find(j.MemberExpression, {
      // find `stuff.argsForCall[*]`
      object: {
        type: 'MemberExpression',
        property: {
          type: 'Identifier',
          name: 'argsForCall',
        },
      },
    })
    .forEach((path) => {
      // make them `stuff.mock.calls[*]
      path.node.object.object && (path.node.object = path.node.object.object)
      path.node.object = j.memberExpression(path.node.object, j.identifier('mock'))
      path.node.object = j.memberExpression(path.node.object, j.identifier('calls'))
    })

  root
    .find(j.CallExpression, {
      // find `*.calls.argsFor(index)`
      callee: {
        type: 'MemberExpression',
        object: {
          type: 'MemberExpression',
          property: {
            type: 'Identifier',
            name: 'calls',
          },
        },
        property: {
          type: 'Identifier',
          name: 'argsFor',
        },
      },
    })
    .forEach((path) => {
      const expressionMockCalls = j.memberExpression(
        j.memberExpression(path.node.callee.object.object, j.identifier('mock')),
        j.identifier('calls')
      )

      const expressionIndex =
        path.node.arguments[0].type === 'Identifier'
          ? j.memberExpression(expressionMockCalls, path.node.arguments[0], true)
          : j.memberExpression(
              expressionMockCalls,
              j.literal(path.node.arguments[0].value)
            )

      // make it `*.mock.calls[index]`
      j(path).replaceWith(expressionIndex)
    })

  root
    .find(j.MemberExpression, {
      // replace `andCallFake` with `mockImplementation`
      property: {
        type: 'Identifier',
        name: 'andCallFake',
      },
    })
    .forEach((path) => {
      path.node.property.name = 'mockImplementation'
    })

  root
    .find(j.MemberExpression, {
      // replace `andReturn` with `mockReturnValue`
      property: {
        type: 'Identifier',
        name: 'andReturn',
      },
    })
    .forEach((path) => {
      path.node.property.name = 'mockReturnValue'
    })

  root // fin all `andCallThrough` and delete them since
    // jest mocks call through by default
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        property: {
          type: 'Identifier',
          name: 'andCallThrough',
        },
      },
    })
    .forEach((path) => {
      j(path).replaceWith(path.node.callee.object)
    })

  root
    .find(j.CallExpression, {
      // find all `jasmine.clock()`
      callee: {
        type: 'MemberExpression',
        object: {
          type: 'CallExpression',
          callee: {
            object: {
              type: 'Identifier',
              name: 'jasmine',
            },
            property: {
              type: 'Identifier',
              name: 'clock',
            },
          },
        },
      },
    })
    .forEach((path) => {
      const usageType = path.node.callee.property.name
      switch (usageType) {
        case 'install': {
          // make it `jest.useFakeTimers()`
          path.node.callee = j.memberExpression(
            j.identifier('jest'),
            j.identifier('useFakeTimers')
          )
          break
        }
        case 'uninstall': {
          // make it `jest.useRealTimers()`
          path.node.callee = j.memberExpression(
            j.identifier('jest'),
            j.identifier('useRealTimers')
          )
          break
        }
        case 'tick': {
          // make it `jest.advanceTimersByTime(ms)`
          path.node.callee = j.memberExpression(
            j.identifier('jest'),
            j.identifier('advanceTimersByTime')
          )
          break
        }
        case 'mockDate': {
          // make it `jest.setSystemTime(date)`
          path.node.callee = j.memberExpression(
            j.identifier('jest'),
            j.identifier('setSystemTime')
          )
          break
        }
        default: {
          logWarning(
            `Unsupported Jasmine functionality "jasmine.clock().${usageType}".`,
            path
          )
          break
        }
      }
    })

  const jasmineToExpectFunctionNames = [
    'any',
    'anything',
    'arrayContaining',
    'objectContaining',
    'stringMatching',
  ]

  jasmineToExpectFunctionNames.forEach((functionName) => {
    // jasmine.<jasmineToExpectFunctionName>(*)
    root
      .find(j.CallExpression, {
        callee: {
          type: 'MemberExpression',
          object: {
            type: 'Identifier',
            name: 'jasmine',
          },
          property: {
            type: 'Identifier',
            name: functionName,
          },
        },
      })
      .forEach((path) => {
        // `jasmine.<jasmineToExpectFunctionName>(*)` is equivalent of
        // `expect.<jasmineToExpectFunctionName>(*)`
        path.node.callee.object.name = 'expect'
      })
  })

  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: {
          type: 'Identifier',
          name: 'jasmine',
        },
        property: {
          type: 'Identifier',
          name: 'createSpyObj',
        },
      },
    })
    .filter((path) => {
      const args = path.node.arguments
      const isArrayOrObjectExpression = (arg) =>
        arg.type === 'ArrayExpression' || arg.type === 'ObjectExpression'

      const firstArgumentIsMethodNames = isArrayOrObjectExpression(args[0])
      if (firstArgumentIsMethodNames) {
        // ensure that optional baseName is always filled, to simplify arguments handling
        args.unshift(j.literal(''))
      }

      const [, spyObjMethods, spyObjProperties] = args

      return (
        (args.length === 2 || args.length === 3) &&
        isArrayOrObjectExpression(spyObjMethods) &&
        (spyObjProperties === undefined || isArrayOrObjectExpression(spyObjProperties))
      )
    })
    .forEach((path) => {
      const [, spyObjMethods, spyObjProperties] = path.node.arguments

      const properties: ObjectProperty[] =
        spyObjMethods.type === 'ArrayExpression'
          ? spyObjMethods.elements.map((arg) =>
              j.objectProperty(
                j.literal(arg.value),
                j.callExpression(
                  j.memberExpression(j.identifier('jest'), j.identifier('fn')),
                  []
                )
              )
            )
          : spyObjMethods.properties.map((arg) =>
              j.objectProperty(
                j.literal(arg.key.name),
                j.callExpression(
                  j.memberExpression(j.identifier('jest'), j.identifier('fn')),
                  [
                    j.arrowFunctionExpression(
                      [],
                      j.blockStatement([j.returnStatement(arg.value)])
                    ),
                  ]
                )
              )
            )

      if (spyObjProperties !== undefined) {
        properties.push(
          ...(spyObjProperties.type === 'ArrayExpression'
            ? spyObjProperties.elements.map((arg) =>
                j.objectProperty(j.literal(arg.value), j.literal(null))
              )
            : spyObjProperties.properties.map((arg) =>
                j.objectProperty(j.literal(arg.key.name), arg.value)
              ))
        )
      }

      j(path).replaceWith(j.objectExpression(properties))
    })

  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: 'expect',
          },
        },
        property: {
          type: 'Identifier',
          name: (name) => name === 'toEqual' || name === 'toStrictEqual',
        },
      },
      arguments: [
        {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: {
              type: 'Identifier',
              name: 'jasmine',
            },
            property: {
              type: 'Identifier',
              name: 'arrayWithExactContents',
            },
          },
        },
      ],
    })
    .replaceWith((path) => {
      const expectArgument = path.value.callee.object.arguments[0]
      const jasmineArgument = path.value.arguments[0].arguments[0]
      const methodName = path.value.callee.property.name

      const newExpectArgument = j.callExpression(
        j.memberExpression(expectArgument, j.identifier('sort')),
        []
      )

      const newJasmineArgument = j.callExpression(
        j.memberExpression(jasmineArgument, j.identifier('sort')),
        []
      )

      return j.callExpression(
        j.memberExpression(
          j.callExpression(j.identifier('expect'), [newExpectArgument]),
          j.identifier(methodName)
        ),
        [newJasmineArgument]
      )
    })

  return finale(fileInfo, j, root, options)
}
