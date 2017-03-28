module.exports = j => (memberName, node, end) => {
    let rest = node;
    const equalsMemberName = (typeof memberName === 'function') ? memberName : (name => name === memberName);
    const equalsEnd = (typeof end === 'function') ? end : name => name === end;

    while (rest.type === j.MemberExpression.name
    && !equalsMemberName(rest.property.name)
    && !equalsEnd(rest.property.name)
  ) {
        rest = rest.object;
    }

    if (rest.type === j.MemberExpression.name
    && equalsMemberName(rest.property.name)
    && !equalsEnd(rest.property.name)
  ) {
        rest = rest.object;
    }

    return rest;
};
