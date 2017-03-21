
function traceProperties(node, list = []) {
    if (node.type === 'Identifier') {
        return node.name;
    }

    return list
        .concat(node.object ? traceProperties(node.object, list) : [])
        .concat(node.property ? traceProperties(node.property, list) : []);
}

export default function(file, api) {
    const j = api.jscodeshift; // alias the jscodeshift API
    const root = j(file.source); // parse JS code into an AST

    function update(p) {
        const list = traceProperties(p.node);
        const content = list.slice(0, list.length - 1).join('.');
        return j(p).replaceWith(
          j.memberExpression(
            j.callExpression(j.identifier('expect'), [j.identifier(content)]),
            j.identifier('to')
          )
        );
    }

    function updateExist(p) {
        const node = p.node;
        const content = traceProperties(node.arguments[0]).join('.');
        const isNotExistExpression = node.callee.object.type === 'MemberExpression';

        return j(p).replaceWith(j.memberExpression(
          j.callExpression(j.identifier('expect'), [j.identifier(content)]),
          j.identifier(isNotExistExpression ? 'to.not.exist' : 'to.exist')
        ));
    }

    // find and update all should related expressions
    root.find(j.MemberExpression, { property: { name: 'should' } }).forEach(update);
    root.find(j.CallExpression, { callee: { property: { name: 'exist' } } }).forEach(updateExist);

    // print
    return root.toSource();
}
