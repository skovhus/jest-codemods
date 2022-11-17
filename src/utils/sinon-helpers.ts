import { findParentOfType } from './recast-helpers.js'

export function isExpectSinonCall(obj, sinonMethods) {
  if (obj.type === 'CallExpression' && obj.callee.name === 'expect') {
    const args = obj.arguments
    if (args.length) {
      return (
        args[0].type === 'CallExpression' &&
        args[0].callee.type === 'MemberExpression' &&
        sinonMethods.includes(args[0].callee.property.name)
      )
    }
    return false
  } else if (obj.type === 'MemberExpression') {
    return isExpectSinonCall(obj.object, sinonMethods)
  }
}

export function isExpectSinonObject(obj, sinonMethods) {
  if (obj.type === 'CallExpression' && obj.callee.name === 'expect') {
    const args = obj.arguments
    if (args.length) {
      return (
        args[0].type === 'MemberExpression' &&
        sinonMethods.includes(args[0].property.name)
      )
    }
    return false
  } else if (obj.type === 'MemberExpression') {
    return isExpectSinonObject(obj.object, sinonMethods)
  }
}

export function getExpectArg(obj) {
  if (obj.type === 'MemberExpression') {
    return getExpectArg(obj.object)
  } else {
    return obj.arguments[0]
  }
}

export function modifyVariableDeclaration(nodePath, newNodePath) {
  const varDec = findParentOfType(nodePath, 'VariableDeclaration')
  if (!varDec) return
  varDec.parentPath?.value?.forEach?.((n, i) => {
    if (varDec.value === n) {
      varDec.parentPath.value[i] = newNodePath
    }
  })
}

export function expressionContainsProperty(node, memberName) {
  let current = node
  while (current) {
    if (current.property?.name === memberName) {
      return true
    }
    current = current.object
  }
  return false
}
