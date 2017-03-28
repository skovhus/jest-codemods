module.exports = j => (node, fn) => {
    const getExpectNode = n => {
        let curr = n;

        while (curr.type === j.MemberExpression.name ||
    (curr.type === j.CallExpression.name && curr.callee.name !== 'expect')) {
            if (curr.type === j.MemberExpression.name) {
                curr = curr.object;
            } else if (curr.type === j.CallExpression.name) {
                curr = curr.callee;
            }
        }

        return curr;
    };

    const expectNode = getExpectNode(node);

    if (expectNode == null || expectNode.arguments == null) {
        return node;
    }

    const args = expectNode.arguments.map(fn);

    return j.callExpression(j.identifier('expect'), args);
};
