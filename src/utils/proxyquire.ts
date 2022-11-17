import { removeRequireAndImport } from './imports.js'
import logger from './logger.js'

function findChildOfProgram(path, childPath = undefined) {
  if (path.value.type === 'Program') {
    return childPath
  }
  return findChildOfProgram(path.parent, path)
}

const getJestMockStatement = ({ j, mockName, mockBody }) =>
  j.expressionStatement(
    j.callExpression(j.identifier('jest.mock'), [
      mockName,
      j.arrowFunctionExpression([], mockBody),
    ])
  )

function getIdentifierValue(ast, name) {
  const varDec = ast.findVariableDeclarators(name).get(0)

  if (varDec && 'value' in varDec.node.init) {
    return varDec.node.init.value
  }

  return null
}

export default function proxyquireTransformer(fileInfo, j, ast) {
  const importVariableName = removeRequireAndImport(j, ast, 'proxyquire')
  if (importVariableName) {
    const mocks = new Set()

    ast
      .find(j.CallExpression)
      .filter((path) => {
        const match = path.value
        if (
          match.callee.type === 'CallExpression' &&
          match.callee.callee.type === 'MemberExpression'
        ) {
          return match.callee.callee.object.name === importVariableName
        } else if (
          match.callee.type === 'MemberExpression' &&
          match.callee.object.type === 'CallExpression' &&
          match.callee.object.callee.type === 'MemberExpression'
        ) {
          return match.callee.object.callee.object.name === importVariableName
        } else if (
          match.callee.type === 'MemberExpression' &&
          match.callee.object.name === importVariableName
        ) {
          const parent = path.parentPath.value
          return parent && parent.type !== 'CallExpression'
        }

        return match.callee.name === importVariableName
      })
      .forEach((outerCallExpression) => {
        const args = outerCallExpression.node.arguments
        if (args.length === 0) {
          // proxyquire is called with no arguments
          j(outerCallExpression).remove()
          return
        }

        const pathArg = args[0]
        const requireFile =
          pathArg.type === 'Identifier'
            ? getIdentifierValue(ast, pathArg.name)
            : pathArg.value

        const mocksNode = args[1]

        if (mocks.has(requireFile)) {
          logger(
            fileInfo,
            'Multiple mocks of same file is not supported',
            outerCallExpression
          )
          return
        }
        mocks.add(requireFile)

        if (mocksNode.type === 'ObjectExpression') {
          mocksNode.properties.forEach((o) => {
            const jestMockStatement = getJestMockStatement({
              j,
              mockName: o.key,
              mockBody: o.value,
            })
            findChildOfProgram(outerCallExpression).insertBefore(jestMockStatement)
          })
        } else if (mocksNode.type === 'Identifier') {
          // Look for an ObjectExpression that defines the mocks
          let mocksObjectExpression
          ast
            .find(j.VariableDeclarator, {
              id: { name: mocksNode.name },
            })
            .filter((path) => path.node.init.type === 'ObjectExpression')
            .forEach((path) => {
              mocksObjectExpression = path.node.init
            })

          if (!mocksObjectExpression) {
            logger(
              fileInfo,
              'proxyrequire mocks not transformed due to missing declaration',
              outerCallExpression
            )
            return
          }

          mocksObjectExpression.properties.forEach((o) => {
            const mockName = o.key
            const jestMockStatement = getJestMockStatement({
              j,
              mockName,
              mockBody: j.memberExpression(j.identifier(mocksNode.name), mockName),
            })
            findChildOfProgram(outerCallExpression).insertBefore(jestMockStatement)
          })
        } else {
          return
        }

        const newCallExpressionNode = j.callExpression(j.identifier('require'), [
          j.literal(requireFile),
        ])
        j(outerCallExpression).replaceWith(newCallExpressionNode)
      })
  }
}
