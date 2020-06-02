/**
 * Find the identifier from a given MemberExpression
 *
 * Example: return `foo` for a node of `foo.bar.baz()`
 *
 * @param  {MemberExpression} node
 * @return {string|null}
 */
export function getIdentifierFromExpression(node) {
  if (!node) {
    return null
  }
  if (node.type === 'Identifier') {
    return node
  }
  return getIdentifierFromExpression(node.object)
}

/**
 * Returns list of elements from a given MemberExpression
 *
 * Example: return ['foo', 'bar', 'baz'] for a node of `foo.bar.baz()`
 *
 * @param  {MemberExpression} node
 * @return {array}
 */
export function getMemberExpressionElements(node, _rest = []) {
  if (node.object.type === 'Identifier') {
    return [node.object.name, node.property.name].concat(_rest)
  }
  return getMemberExpressionElements(node.object, [node.property.name].concat(_rest))
}

export function findParentCallExpression(path, name) {
  if (!path) {
    return null
  }
  if (
    path.value.type === 'CallExpression' &&
    path.value.callee.property &&
    path.value.callee.property.name === name
  ) {
    return path
  }
  return findParentCallExpression(path.parentPath, name)
}

export function findParentVariableDeclaration(path) {
  return findParentOfType(path, 'VariableDeclarator')
}

export function findParentOfType(path, type) {
  if (!path || !path.value) {
    return null
  }
  if (path.value.type === type) {
    return path
  }
  return findParentOfType(path.parentPath, type)
}

export function traverseMemberExpressionUtil(j, nodeValidator) {
  const traverseMemberExpression = (node) => {
    if (!node) {
      return false
    }

    if (nodeValidator(node)) {
      return true
    }

    return traverseMemberExpression(node.object)
  }

  return traverseMemberExpression
}
