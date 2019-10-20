/**
 * Codemod for transforming Jasmine `this` context into Jest v20+ compatible syntax.
 */
import * as jscodeshift from 'jscodeshift'
import { Collection } from 'jscodeshift/src/Collection'
import { NodePath } from 'recast'

import finale from '../utils/finale'

// The ascending ordering for which setup function should be used. For example,
// if there are only `beforeEach` blocks, then that should be used to setup
// the test context. However, if there are any `beforeAll` blocks, the test
// context must be initialized in a `beforeAll` block so that it runs before.
const rankedSetupFunctionNames = ['beforeEach', 'beforeAll']
const testFunctionNames = [
  'after',
  'afterEach',
  'it',
  'test',
  'afterAll',
  'before',
].concat(rankedSetupFunctionNames)
const allFunctionNames = ['describe'].concat(testFunctionNames)
const ignoredIdentifiers = ['retries', 'skip', 'slow', 'timeout']
const contextName = 'testContext'

const jasmineThis: jscodeshift.Transform = (fileInfo, api, options) => {
  const j = api.jscodeshift
  const root = j(fileInfo.source)

  // Track the index of the most general hook that references `this`. This is
  // necessary because the setup hook that initializes the testing context must
  // run before the testing context is referenced.
  let setupFunctionNameIndex = 0

  function isFunctionExpressionWithinSpecificFunctions(path, acceptedFunctionNames) {
    if (!path || !path.parentPath || !Array.isArray(path.parentPath.value)) {
      return false
    }

    const callExpressionPath = path.parentPath.parentPath

    const isWithin =
      !!callExpressionPath &&
      !!callExpressionPath.value &&
      callExpressionPath.value.callee &&
      callExpressionPath.value.callee.type === 'Identifier' &&
      acceptedFunctionNames.indexOf(callExpressionPath.value.callee.name) > -1

    // Keep track of the setup function with the highest precedence. When the
    // function that that we are in is one of the setup function names and it's
    // of higher precedence, then update to setup the test context with the
    // correct setup function.
    if (
      isWithin &&
      rankedSetupFunctionNames.indexOf(callExpressionPath.value.callee.name) >
        setupFunctionNameIndex
    ) {
      setupFunctionNameIndex = rankedSetupFunctionNames.indexOf(
        callExpressionPath.value.callee.name
      )
    }

    return isWithin
  }

  function isWithinObjectOrClass(path) {
    const invalidParentTypes = ['Property', 'MethodDefinition']
    let currentPath = path

    while (
      currentPath &&
      currentPath.value &&
      invalidParentTypes.indexOf(currentPath.value.type) === -1
    ) {
      currentPath = currentPath.parentPath
    }
    return currentPath ? invalidParentTypes.indexOf(currentPath.value.type) > -1 : false
  }

  function isWithinSpecificFunctions(
    path: NodePath<jscodeshift.MemberExpression, jscodeshift.MemberExpression>,
    acceptedFunctionNames,
    matchAll
  ) {
    if (!matchAll) {
      // Do not replace within functions declared as object properties or class methods
      // See `transforms plain functions within lifecycle methods` test
      if (isWithinObjectOrClass(path)) {
        return false
      }
    }
    let currentPath = path

    while (
      currentPath &&
      currentPath.value &&
      currentPath.value.type === 'MemberExpression'
    ) {
      currentPath = currentPath.parentPath
    }

    return (
      isFunctionExpressionWithinSpecificFunctions(currentPath, acceptedFunctionNames) ||
      (currentPath
        ? isWithinSpecificFunctions(currentPath.parentPath, testFunctionNames, false)
        : false)
    )
  }

  const getValidThisExpressions = node => {
    return j(node)
      .find(j.MemberExpression, {
        object: {
          type: 'ThisExpression',
        },
        property: {
          name: name => ignoredIdentifiers.indexOf(name) === -1,
        },
      })
      .filter(path => isWithinSpecificFunctions(path, allFunctionNames, true))
  }

  const mutateScope = (ast: Collection<any>, body) => {
    const replacedIdentifiers = []

    const updateThisExpressions = () => {
      return ast
        .find(j.MemberExpression, {
          object: {
            type: 'ThisExpression',
          },
        })
        .filter(path => isWithinSpecificFunctions(path, allFunctionNames, true))
        .replaceWith(replaceThisExpression)
        .size()
    }

    const replaceThisExpression = path => {
      const { name } = path.value.property

      replacedIdentifiers.push(name)

      return j.memberExpression(j.identifier(contextName), j.identifier(name), false)
    }

    const addDeclarations = () => {
      if (!replacedIdentifiers.length) {
        return
      }
      body.unshift(
        j.expressionStatement(
          j.callExpression(
            j.identifier(rankedSetupFunctionNames[setupFunctionNameIndex]),
            [
              j.arrowFunctionExpression(
                [],
                j.blockStatement([
                  j.expressionStatement(
                    j.assignmentExpression(
                      '=',
                      j.identifier(contextName),
                      j.objectExpression([])
                    )
                  ),
                ])
              ),
            ]
          )
        )
      )
      body.unshift(
        j.variableDeclaration('let', [
          j.variableDeclarator(
            j.identifier.from({
              name: contextName,
              typeAnnotation: ['ts', 'tsx'].includes(options.parser)
                ? j.typeAnnotation(j.anyTypeAnnotation())
                : null,
            }),
            null
          ),
        ])
      )
    }

    updateThisExpressions()
    addDeclarations()
  }

  const mutateDescribe = path => {
    const functionExpression = path.value.arguments.find(
      node =>
        node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression'
    )
    const functionBody = functionExpression.body
    const ast = j(functionBody)

    mutateScope(ast, functionBody.body)
  }

  const updateRoot = () => {
    const topLevelLifecycleMethods = root
      .find(j.CallExpression, {
        callee: {
          type: 'Identifier',
          name: name => testFunctionNames.indexOf(name) > -1,
        },
      }) // Find only lifecyle methods which are in the root scope
      .filter(
        path =>
          path.parentPath.value.type === 'ExpressionStatement' &&
          Array.isArray(path.parentPath.parentPath.value) &&
          path.parentPath.parentPath.parentPath.value.type === 'Program'
      )
      .filter(path => getValidThisExpressions(path.value).size() > 0)
      .size()

    if (topLevelLifecycleMethods > 0) {
      const path = root.get()
      mutateScope(root, path.value.program.body)
      return 1
    }

    return 0
  }

  const updateDescribes = () => {
    return root
      .find(j.CallExpression, {
        callee: {
          type: 'Identifier',
          name: 'describe',
        },
      })
      .filter(path => getValidThisExpressions(path.value).size() > 0)
      .forEach(mutateDescribe)
      .size()
  }

  const updateFunctionExpressions = () => {
    return root
      .find(j.FunctionExpression)
      .filter(path => isFunctionExpressionWithinSpecificFunctions(path, allFunctionNames))
      .filter(path => !path.value.generator)
      .replaceWith(path => {
        const newFn = j.arrowFunctionExpression(
          path.value.params,
          path.value.body,
          path.value.expression
        )
        newFn.async = path.value.async
        return newFn
      })
      .size()
  }

  const mutations = updateRoot() + updateDescribes() + updateFunctionExpressions()

  if (!mutations) {
    return null
  }

  return finale(fileInfo, j, root, options)
}

export default jasmineThis
