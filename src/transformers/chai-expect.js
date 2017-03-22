
const mappings = {
    equals: 'toBe',
    equal: 'toBe',
    eql: 'toEqual',
    exist: 'anything',
    // TODO ...
};

export default function(file, api) {
    const j = api.jscodeshift; // alias the jscodeshift API
    const root = j(file.source); // parse JS code into an AST

    function update(p) {
        console.log(p.node.callee.property.name);
        p.node.callee.property = j.identifier(mappings[p.node.callee.property.name]);
        p.node.callee.object = p.node.callee.object.object;
    }

    function updateExist(p) {
        p.node.expression.property = j.callExpression(
          j.identifier('toEqual'), [j.callExpression(j.identifier('anything'), [])]
        );

        const expObject = p.node.expression.object;
        p.node.expression.object = expObject.property.name === 'not' ?
          j.memberExpression(expObject.object.object, j.identifier('not')) : expObject.object;
    }

    function updateInstanceOf(p) {
        const callExpression = p.node.expression;
        callExpression.arguments = [j.callExpression(
          j.memberExpression(j.identifier('expect'), j.identifier('any')),
          callExpression.arguments)];

        const callee = callExpression.callee;
        callee.property = j.identifier('toEqual');
        let expectObj = callee.object;
        while (expectObj.type !== 'CallExpression' && (expectObj.property || {}).name !== 'not') {
            expectObj = expectObj.object;
        }

        callee.object = expectObj;
    }

    // find and update all expect(...) statements:
    root.find(j.CallExpression, {
        callee: {
            object: { object: { callee: { name: 'expect' } } },
        },
    }).forEach(update);

    // find and update all exist statements:
    root.find(j.ExpressionStatement, {
        expression: { property: { name: 'exist' } },
    }).forEach(updateExist);

    // find and update all instanceof statements:
    root.find(j.ExpressionStatement, {
        expression: { callee: { property: { name: 'instanceof' } } },
    }).forEach(updateInstanceOf);

    // print
    return root.toSource();
}
