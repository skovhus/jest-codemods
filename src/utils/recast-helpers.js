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
        return null;
    }
    if (node.type === 'Identifier') {
        return node;
    }
    return getIdentifierFromExpression(node.object);
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
        return [node.object.name, node.property.name].concat(_rest);
    }
    return getMemberExpressionElements(node.object, [node.property.name].concat(_rest));
}
