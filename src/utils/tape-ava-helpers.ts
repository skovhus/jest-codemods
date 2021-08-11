import logger from './logger'

/**
 * Rewrite last argument of a given CallExpression path
 * @param  {jscodeshift} j
 * @param  {CallExpression} path
 * @param  {string} newArgument
 */
function renameTestFunctionArgument(j, path, newArgument) {
  const lastArg = path.node.arguments[path.node.arguments.length - 1]
  if (!lastArg) {
    return
  }
  if (lastArg.type === 'ArrowFunctionExpression') {
    const arrowFunction = j.arrowFunctionExpression(
      [j.identifier(newArgument === '' ? '()' : newArgument)],
      lastArg.body,
      false
    )
    arrowFunction.async = lastArg.async
    path.node.arguments[path.node.arguments.length - 1] = arrowFunction
  } else if (lastArg.type === 'FunctionExpression') {
    lastArg.params = [j.identifier(newArgument)]
  }
}

/**
 * Rewrite Tape or AVA failing assertion (t.fail)
 * @param  {jscodeshift} j
 * @param  {CallExpression} path
 * @return {boolean}    if any paths were changed
 */
function rewriteFailingAssertion(j, path) {
  return (
    j(path)
      .find(j.CallExpression, {
        callee: {
          object: { name: 't' },
          property: { name: 'fail' },
        },
      })
      .forEach((pFail) => {
        pFail.node.callee = j.identifier('done.fail')
      })
      .size() > 0
  )
}

/**
 * Rewrite Tape or AVA async callbacks (t.end)
 * @param  {jscodeshift} j
 * @param  {CallExpression} path
 * @return {boolean}    if any paths were changed
 */
function rewriteEndCallback(j, path) {
  // calls to t.end()
  const containsCalls =
    j(path)
      .find(j.CallExpression, {
        callee: {
          object: { name: 't' },
          property: { name: 'end' },
        },
      })
      .filter((p) => {
        // if t.end is in the scope of the test function we remove it
        const outerParent = p.parent.parent.parent.node
        const inTestScope =
          outerParent.params &&
          outerParent.params[0] &&
          outerParent.params[0].name === 't'
        if (inTestScope) {
          p.prune()
          return null
        }

        // else it might be used for async testing. We rename it to
        // familiar Jasmine 'done()'
        p.node.callee = j.identifier('done')
        return true
      })
      .size() > 0

  // references to t.end
  const containsReference =
    j(path)
      .find(j.MemberExpression, {
        object: { name: 't' },
        property: { name: 'end' },
      })
      .replaceWith(j.identifier('done'))
      .size() > 0

  return containsCalls || containsReference
}

/**
 * Remove t.pass (no equivalent in Jest)
 * @param  {jscodeshift} j
 * @param  {CallExpression} path
 */
function removePassingAssertion(j, path) {
  // t.pass is a no op
  j(path)
    .find(j.CallExpression, {
      callee: {
        object: { name: 't' },
        property: { name: 'pass' },
      },
    })
    .remove()
}

/**
 * Rewrites CallExpression by:
 * - removing 't.pass' calls
 * - 't.end' calls are possible remove or renamed to 'done'
 * - 't.fail' calls are changed to 'done.fail'
 *
 * @param  {jscodeshift} j
 * @param  {CallExpression} path of test function
 */
export function rewriteAssertionsAndTestArgument(j, path) {
  const containsFailCalls = rewriteFailingAssertion(j, path)
  const containsEndCalls = rewriteEndCallback(j, path)
  removePassingAssertion(j, path)
  const argumentName = containsEndCalls || containsFailCalls ? 'done' : ''
  renameTestFunctionArgument(j, path, argumentName)
}

/**
 * Rewrite test callback to be able to destructure its argument
 *
 * test(({ok}) => {ok()}) to test(t => {ok()})
 */
export function rewriteDestructuredTArgument(fileInfo, j, ast, testFunctionName) {
  ast
    .find(j.CallExpression, {
      callee: (callee) =>
        callee.name === testFunctionName ||
        (callee.object && callee.object.name === testFunctionName),
    })
    .forEach((p) => {
      // The last arg is the test callback
      const lastArg = p.value.arguments[p.value.arguments.length - 1]
      const lastArgParam = lastArg && lastArg.params && lastArg.params[0]
      if (lastArgParam && lastArgParam.type === 'ObjectPattern') {
        const objectPattern = lastArg.params[0]
        const keys = objectPattern.properties.map((prop) => prop.key.name)
        lastArg.params[0] = j.identifier('t')

        keys.forEach((key) => {
          j(lastArg)
            .find(j.CallExpression, {
              callee: { name: key },
            })
            .forEach((assertion) => {
              j(assertion).replaceWith(
                j.callExpression(
                  j.memberExpression(j.identifier('t'), j.identifier(key)),
                  assertion.node.arguments
                )
              )
            })
        })
      }
    })
}

/**
 * Rewrite Execution reference name if not 't'
 *
 * @param fileInfo
 * @param {jscodeshift} j
 * @param {Collection} ast
 * @param {string} testFunctionName
 */
export function renameExecutionInterface(fileInfo, j, ast, testFunctionName) {
  ast
    .find(j.CallExpression, {
      callee: (callee) =>
        callee.name === testFunctionName ||
        (callee.object && callee.object.name === testFunctionName),
    })
    .forEach((p) => {
      const lastArg = p.value.arguments[p.value.arguments.length - 1]
      if (lastArg?.params?.[0]) {
        const lastArgName = lastArg.params[0].name
        if (lastArgName === 't') {
          return
        }
        j(p)
          .find(j.Identifier, {
            name: lastArgName,
          })
          .filter((path) => path.parent.node === lastArg)
          .forEach((path) => {
            path.get('name').replace('t')
            const rootScope = path.scope
            j(p)
              .find(j.CallExpression, { callee: { object: { name: lastArgName } } })
              .forEach((path) => {
                let { scope } = path
                while (scope && scope !== rootScope) {
                  if (scope.declares(lastArgName)) {
                    return
                  }
                  scope = scope.parent
                }

                path.node.callee.object.name = 't'
              })
          })
      }
    })
}

/**
 * Validated that "t" is the test argument name.
 *
 * Example: 'test(x => {})' gives a warning.
 */
export function detectUnsupportedNaming(fileInfo, j, ast, testFunctionName) {
  ast
    .find(j.CallExpression, {
      callee: (callee) =>
        callee.name === testFunctionName ||
        (callee.object && callee.object.name === testFunctionName),
    })
    .forEach((p) => {
      const lastArg = p.value.arguments[p.value.arguments.length - 1]
      if (lastArg && lastArg.params && lastArg.params[0]) {
        const lastArgName = lastArg.params[0].name

        // Currently we only support "t" as the test argument name
        if (lastArgName !== 't') {
          logger(
            fileInfo,
            `Argument to test function should be named "t" not "${lastArgName}"`,
            p
          )
        }
      }
    })
}
