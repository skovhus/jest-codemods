/**
 * Codemod for transforming AVA tests into Jest.
 */
import * as jscodeshift from 'jscodeshift'
import { Identifier, MemberExpression } from 'jscodeshift'

import { PROP_WITH_SECONDS_ARGS } from '../utils/consts.js'
import finale from '../utils/finale.js'
import { removeRequireAndImport } from '../utils/imports.js'
import { getLogWarningForFile } from '../utils/logger.js'
import {
  getIdentifierFromExpression,
  getMemberExpressionElements,
} from '../utils/recast-helpers.js'
import {
  renameExecutionInterface,
  rewriteAssertionsAndTestArgument,
  rewriteDestructuredTArgument,
} from '../utils/tape-ava-helpers.js'

const SPECIAL_THROWS_CASE = '(special throws case)'
const SPECIAL_BOOL = '(special bool case)'
const SPECIAL_PLAN_CASE = '(special plan case)'

const tPropertiesMap = {
  ok: 'toBeTruthy',
  truthy: 'toBeTruthy',
  falsy: 'toBeFalsy',
  notOk: 'toBeFalsy',
  true: SPECIAL_BOOL,
  false: SPECIAL_BOOL,
  is: 'toBe',
  not: 'not.toBe',
  same: 'toEqual',
  deepEqual: 'toEqual',
  notSame: 'not.toEqual',
  notDeepEqual: 'not.toEqual',
  throws: SPECIAL_THROWS_CASE,
  notThrows: SPECIAL_THROWS_CASE,
  regex: 'toMatch',
  notRegex: 'not.toMatch',
  ifError: 'toBeFalsy',
  error: 'toBeFalsy',
  plan: SPECIAL_PLAN_CASE,
  snapshot: 'toMatchSnapshot',
}

const tPropertiesNotMapped = new Set(['end', 'fail', 'pass'])

const avaToJestMethods = {
  before: 'beforeAll',
  after: 'afterAll',
  beforeEach: 'beforeEach',
  afterEach: 'afterEach',
  only: 'test.only',
  skip: 'test.skip',
  failing: 'test.skip',
  todo: 'test.todo',
}

const avaToJest: jscodeshift.Transform = (fileInfo, api, options) => {
  const j = api.jscodeshift
  const ast = j(fileInfo.source)

  const testFunctionName = removeRequireAndImport(j, ast, 'ava')

  if (!testFunctionName && !options.skipImportDetection) {
    // No AVA require/import were found
    return fileInfo.source
  }

  const logWarning = getLogWarningForFile(fileInfo)

  const transforms = [
    () => rewriteDestructuredTArgument(fileInfo, j, ast, testFunctionName),
    () => renameExecutionInterface(fileInfo, j, ast, testFunctionName),
    function updateAssertions() {
      ast
        .find(j.CallExpression, {
          callee: {
            object: { name: 't' },
            property: ({ name }) => !tPropertiesNotMapped.has(name),
          },
        })
        .forEach((p) => {
          const args = p.node.arguments
          const oldPropertyName =
            p.value.callee.type === 'MemberExpression' &&
            p.value.callee.property.type === 'Identifier' &&
            p.value.callee.property.name
          const newPropertyName = tPropertiesMap[oldPropertyName]
          if (typeof newPropertyName === 'undefined') {
            logWarning(`"t.${oldPropertyName}" is currently not supported`, p)
            return null
          }

          let newCondition
          if (newPropertyName === SPECIAL_BOOL) {
            newCondition = j.callExpression(j.identifier('toBe'), [
              j.identifier(oldPropertyName),
            ])
          } else if (newPropertyName === SPECIAL_PLAN_CASE) {
            const condition = j.memberExpression(
              j.identifier('expect'),
              j.callExpression(j.identifier('assertions'), [args[0]])
            )
            return j(p).replaceWith(condition)
          } else if (newPropertyName === SPECIAL_THROWS_CASE) {
            if (args.length === 1) {
              newCondition = j.callExpression(
                j.identifier(oldPropertyName === 'throws' ? 'toThrow' : 'not.toThrow'),
                []
              )
            } else {
              newCondition = j.callExpression(
                j.identifier(
                  oldPropertyName === 'throws' ? 'toThrowError' : 'not.toThrowError'
                ),
                [args[1]]
              )
            }
          } else {
            const hasSecondArgument = PROP_WITH_SECONDS_ARGS.indexOf(newPropertyName) >= 0

            if (hasSecondArgument && args.length < 2) {
              logWarning(`"t.${oldPropertyName}" should have 2 arguments`, p)
              return
            }

            const [_arg0, arg1, arg2] = args
            let conditionArgs = hasSecondArgument ? [arg1] : []

            if (newPropertyName === 'toMatchSnapshot') {
              // Can take an optional message argument
              if (arg1 && arg1.type === 'Literal') {
                conditionArgs = [arg1]
              } else if (arg2 && arg2.type === 'Literal') {
                conditionArgs = [arg2]
              }
            }

            newCondition = j.callExpression(j.identifier(newPropertyName), conditionArgs)
          }

          const newExpression = j.memberExpression(
            j.callExpression(j.identifier('expect'), [args[0]]),
            newCondition
          )

          return j(p).replaceWith(newExpression)
        })
    },
    function rewriteTestCallExpression() {
      // Can either be simple CallExpression like test()
      // Or MemberExpression like test.after.skip()

      ast
        .find(j.CallExpression, {
          callee: { name: testFunctionName },
        })
        .forEach((p) => {
          if (p.node.callee.type === 'Identifier') {
            p.node.callee.name = 'test'
            rewriteAssertionsAndTestArgument(j, p)
          }
        })

      function mapPathToJestCallExpression(p) {
        let { scope } = p

        const {
          node: {
            callee: {
              object: { name },
            },
          },
        } = p

        while (scope) {
          if (scope.declares(name)) {
            return j.callExpression(
              j.memberExpression(p.node.callee.object, p.node.callee.property),
              p.node.arguments
            )
          }
          scope = scope.parent
        }
        let jestMethod = 'test'
        const jestMethodArgs = p.node.arguments

        // List like ['test', 'serial', 'cb', 'always']
        const avaMethods = getMemberExpressionElements(p.node.callee).filter(
          (e) => e !== 'serial' && e !== testFunctionName && e !== 'cb' && e != 'always'
        )

        if (avaMethods.length === 1) {
          const avaMethod = avaMethods[0]
          if (avaMethod in avaToJestMethods) {
            jestMethod = avaToJestMethods[avaMethod]
          } else {
            jestMethod = avaMethod
            logWarning(`Unknown AVA method "${avaMethod}"`, p)
          }
        } else if (avaMethods[0] === 'context') {
          let identifier: Identifier | MemberExpression = j.identifier(avaMethods[0])
          avaMethods.slice(1).forEach((next) => {
            identifier = j.memberExpression(identifier, j.identifier(next))
          })
          return j.callExpression(identifier, jestMethodArgs)
        } else if (avaMethods.length > 0) {
          logWarning('Skipping setup/teardown hooks is currently not supported', p)
        }

        return j.callExpression(j.identifier(jestMethod), jestMethodArgs)
      }

      ast
        .find(j.CallExpression, {
          callee: {
            type: 'MemberExpression',
          },
        })
        .filter((p) => {
          const identifier = getIdentifierFromExpression(p.node.callee)
          if (identifier === null) {
            return null
          }
          if (identifier.name === testFunctionName) {
            return Boolean(p)
          }
          return null
        })
        .forEach((p) => {
          rewriteAssertionsAndTestArgument(j, p)
        })
        .replaceWith(mapPathToJestCallExpression)
    },
  ]

  transforms.forEach((t) => t())

  return finale(fileInfo, j, ast, options)
}

export default avaToJest
