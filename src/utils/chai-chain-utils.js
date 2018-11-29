import { JEST_MATCHER_TO_MAX_ARGS } from './consts';

export const createCallUtil = j => (fnName, args, rest, containsNot) => {
    const expression = containsNot ? j.memberExpression(rest, j.identifier('not')) : rest;

    const numberOfArgs = JEST_MATCHER_TO_MAX_ARGS[fnName];
    if (typeof numberOfArgs === 'undefined') {
        throw new Error(`Unknown matcher "${fnName}" (JEST_MATCHER_TO_MAX_ARGS)`);
    }

    return j.memberExpression(
        expression,
        j.callExpression(j.identifier(fnName), args.slice(0, numberOfArgs))
    );
};

export const chainContainsUtil = j => (fnName, node, end) => {
    let curr = node;
    const checkEnd = typeof end === 'function' ? end : name => name === end;

    while (
        curr.type === j.MemberExpression.name &&
        curr.property.name !== fnName &&
        !checkEnd(curr.property.name)
    ) {
        curr = curr.object;
    }

    return curr.type === j.MemberExpression.name && curr.property.name === fnName;
};

export const getNodeBeforeMemberExpressionUtil = j => (equalsMemberName, node, end) => {
    let rest = node;

    while (
        rest.type === j.MemberExpression.name &&
        !equalsMemberName(rest.property.name) &&
        rest.property.name !== end
    ) {
        rest = rest.object;
    }

    if (
        rest.type === j.MemberExpression.name &&
        equalsMemberName(rest.property.name) &&
        rest.property.name !== end
    ) {
        rest = rest.object;
    }

    return rest;
};

export const getExpectNodeUtil = j => node => {
    let curr = node;

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

export const updateExpectUtil = j => (node, fn) => {
    const expectNode = getExpectNodeUtil(j)(node);

    if (expectNode == null || expectNode.arguments == null) {
        return node;
    }

    const args = expectNode.arguments.map(fn);

    return j.callExpression(j.identifier('expect'), args);
};

export const createCallChainUtil = j => (chain, args) => {
    const arr = chain.reverse();

    let val = arr.pop();
    let temp = typeof val === 'string' ? j.identifier(val) : val;
    let curr = temp;

    while (chain.length) {
        val = arr.pop();
        temp = typeof val === 'string' ? j.identifier(val) : val;
        curr = j.memberExpression(curr, temp);
    }

    return j.callExpression(curr, args);
};
