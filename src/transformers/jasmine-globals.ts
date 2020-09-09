/**
 * Codemod for transforming Jasmine globals into Jest.
 */
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
      // find spyOn().and.*() expressions
      callee: {
        type: 'MemberExpression',
        object: {
          type: 'MemberExpression',
          property: { name: 'and' },
          object: {
            type: 'CallExpression',
            callee: {
              type: 'Identifier',
              name: 'spyOn',
            },
          },
        },
      },
    })
    .forEach((path) => {
      const spyType = path.node.callee.property.name
      switch (spyType) {
        // if it's `spyOn().and.callThrough()`
        // we should remove it and make just `spyOn()`
        // because jest calls through by default
        case 'callThrough': {
          const { callee } = path.node.callee.object.object
          const arg = path.node.callee.object.object.arguments
          path.node.callee = callee
          path.node.arguments = arg
          break
        }
        // if it's `spyOn().and.callFake()` replace with jest's
        // equivalent `spyOn().mockImplementation();
        case 'callFake': {
          path.node.callee.object = path.node.callee.object.object
          path.node.callee.property.name = 'mockImplementation'
          break
        }
        // `spyOn().and.returnValue()` is equivalent of
        // `jest.spyOn().mockReturnValue()`
        case 'returnValue': {
          path.node.callee.object = path.node.callee.object.object
          path.node.callee.property.name = 'mockReturnValue'
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

      // make it `*.mock.calls[index]`
      j(path).replaceWith(j.memberExpression(expressionMockCalls, path.node.arguments[0]))
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
          logWarning(
            'Unsupported Jasmine functionality "jasmine.clock().mockDate(*)".',
            path
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
    .filter(
      (path) =>
        path.node.arguments.length === 2 &&
        path.node.arguments[1].type === 'ArrayExpression'
    )
    .forEach((path) => {
      const properties = path.node.arguments[1].elements.map((arg) =>
        j.objectProperty(
          j.literal(arg.value),
          j.callExpression(
            j.memberExpression(j.identifier('jest'), j.identifier('fn')),
            []
          )
        )
      )

      j(path).replaceWith(j.objectExpression(properties))
    })

  return finale(fileInfo, j, root, options)
}
