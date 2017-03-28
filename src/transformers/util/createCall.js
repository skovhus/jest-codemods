module.exports = j => (fnName, args, rest, containsNot) => {
    const expression = containsNot ? j.memberExpression(rest, j.identifier('not')) : rest;

    return j.memberExpression(
    expression,
    j.callExpression(
      j.identifier(fnName),
      args
    ));
};
