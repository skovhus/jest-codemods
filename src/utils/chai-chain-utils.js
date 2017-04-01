export const createCallUtil = j => (fnName, args, rest, containsNot) => {
    const expression = containsNot ? j.memberExpression(rest, j.identifier('not')) : rest;

    return j.memberExpression(
        expression,
        j.callExpression(
            j.identifier(fnName),
            args
        )
    );
};

export const chainContainsUtil = j => (fnName, node, end) => {
    let curr = node;
    const checkEnd = (typeof end === 'function') ? end : name => name === end;

    while (
        curr.type === j.MemberExpression.name &&
        curr.property.name !== fnName &&
        !checkEnd(curr.property.name)
    ) {
        curr = curr.object;
    }

    return curr.type === j.MemberExpression.name && curr.property.name === fnName;
};

export const getNodeBeforeMemberExpressionUtil = j => (memberName, node, end) => {
    let rest = node;
    const equalsMemberName = (typeof memberName === 'function') ? memberName : (name => name === memberName);
    const equalsEnd = (typeof end === 'function') ? end : name => name === end;

    while (
        rest.type === j.MemberExpression.name &&
        !equalsMemberName(rest.property.name) &&
        !equalsEnd(rest.property.name)
    ) {
        rest = rest.object;
    }

    if (
        rest.type === j.MemberExpression.name &&
        equalsMemberName(rest.property.name) &&
        !equalsEnd(rest.property.name)
    ) {
        rest = rest.object;
    }

    return rest;
};

export const updateExpectUtil = j => (node, fn) => {
    const getExpectNode = n => {
        let curr = n;

        while (
            curr.type === j.MemberExpression.name ||
            (curr.type === j.CallExpression.name && curr.callee.name !== 'expect')
        ) {
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

export const createCallChainUtil = j => (chain, args) => {
    const arr = chain.reverse();

    let val = arr.pop();
    let temp = (typeof val === 'string') ? j.identifier(val) : val;
    let curr = temp;

    while (chain.length) {
        val = arr.pop();
        temp = (typeof val === 'string') ? j.identifier(val) : val;
        curr = j.memberExpression(curr, temp);
    }

    return j.callExpression(curr, args);
};
