

export default function(file, api) {
    const j = api.jscodeshift; // alias the jscodeshift API
    const root = j(file.source); // parse JS code into an AST

    function getNodeInfo(node) {
        switch (node.type) {
            case 'Literal':
                return node.raw;
            case 'Identifier':
                return node.name;
            default:
                return node;
        }
    }

    function traceProperties(node, list = []) {
        if (node.type === 'MemberExpression') {
            return list
                .concat(node.object ? traceProperties(node.object, list) : [])
                .concat(node.property ? traceProperties(node.property, list) : []);
        }

        return getNodeInfo(node);
    }

    function update(p) {
        const list = traceProperties(p.node);
        list.splice(list.length - 1, 1);

        let parameters;
        if (list.length === 1 && typeof list[0] === 'object') {
            parameters = list;
        } else {
            parameters = [j.identifier(list.join('.'))];
        }

        return j(p).replaceWith(
          j.memberExpression(
            j.callExpression(j.identifier('expect'), parameters),
            j.identifier('to')
          )
        );
    }

    function updateExist(p) {
        const node = p.node;
        const content = [].concat(traceProperties(node.arguments[0])).join('.');
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
