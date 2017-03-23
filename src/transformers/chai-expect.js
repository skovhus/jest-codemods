
const mappings = [
    {
        // exist to toEqual(expect.anything())
        searchOptions: { expression: { property: { name: 'exist' } } },
        identifier: 'toEqual',
        updateArgs: (_, j) => [j.memberExpression(j.identifier('expect'), j.callExpression(j.identifier('anything'), []))],
    },
    {
        // null tp toBeNull()
        searchOptions: { expression: { property: { name: 'null' } } },
        identifier: 'toBeNull',
    },
    {
        // undefined to toBeUndefined()
        searchOptions: { expression: { property: { name: 'undefined' } } },
        identifier: 'toBeUndefined',
    },
    {
        // true to toBeTruthy()
        searchOptions: { expression: { property: { name: 'true' } } },
        identifier: 'toBeTruthy',
    },
    {
        // false to toBeFalsy()
        searchOptions: { expression: { property: { name: 'false' } } },
        identifier: 'toBeFalsy',
    },
    {
        // eql to toEqual
        searchOptions: { expression: { callee: { property: { name: 'eql' } } } },
        identifier: 'toEqual',
        updateArgs: (expression, _) => expression.arguments,
    },
    {
        // equals,equal to toBe
        searchOptions: { expression: { callee: { property: n => /equal/.test(n.name) } } },
        identifier: 'toBe',
        updateArgs: (expression, _) => expression.arguments,
    },
    {
        // closeTo to toBeCloseTo()
        searchOptions: { expression: { callee: { property: { name: 'closeTo' } } } },
        identifier: 'toBeCloseTo',
        updateArgs: (expression, j) => {
            const args = expression.arguments;
            const digits = (args[1].raw.toString().split('.')[1] || '').length.toString();
            return [args[0], digits];
        },
    },
    {
        // above to toBeGreaterThan
        searchOptions: { expression: { callee: { property: { name: 'above' } } } },
        identifier: 'toBeGreaterThan',
        updateArgs: (expression, j) => expression.arguments,
    },
    {
        // least to toBeGreaterThanOrEqual
        searchOptions: { expression: { callee: { property: { name: 'least' } } } },
        identifier: 'toBeGreaterThanOrEqual',
        updateArgs: (expression, _) => expression.arguments,
    },
    {
        // below to toBeLessThan
        searchOptions: { expression: { callee: { property: { name: 'below' } } } },
        identifier: 'toBeLessThan',
        updateArgs: (expression, _) => expression.arguments,
    },
    {
        // most to toBeLessThanOrEqual
        searchOptions: { expression: { callee: { property: { name: 'most' } } } },
        identifier: 'toBeLessThanOrEqual',
        updateArgs: (expression, _) => expression.arguments,
    },
    {
        // instanceof to toBeInstanceOf
        searchOptions: { expression: { callee: { property: { name: 'instanceof' } } } },
        identifier: 'toBeInstanceOf',
        updateArgs: (expression, _) => expression.arguments,
    },
    {
        // lengthOf to toHaveLength
        searchOptions: { expression: { callee: { property: { name: 'lengthOf' } } } },
        identifier: 'toHaveLength',
        updateArgs: (expression, _) => expression.arguments,
    },
    {
        // match to toMatch
        searchOptions: { expression: { callee: { property: { name: 'match' } } } },
        identifier: 'toMatch',
        updateArgs: (expression, _) => expression.arguments,
    },
];

export default function(file, api) {
    const j = api.jscodeshift; // alias the jscodeshift API
    const root = j(file.source); // parse JS code into an AST

    /** utilities */

    function getCallExpression(expression) {
        let callExpression = expression.object;
        while (callExpression.type !== 'CallExpression') {
            callExpression = callExpression.object;
        }
        return callExpression;
    }

    function isNotExpression(expression) {
        let containingNot = false;
        let object = expression.object;
        while (object.type === 'MemberExpression' && !containingNot) {
            containingNot = (object.property || {}).name === 'not';
            object = object.object;
        }
        return containingNot;
    }

    function cleanExpression(expression) {
        const callExpression = getCallExpression(expression);
        if (isNotExpression(expression)) {
            expression.object = j.memberExpression(callExpression, j.identifier('not'));
        } else {
            expression.object = callExpression;
        }
    }

    /** find-and-update related */

    function update(options) {
        return p => {
            const expression = p.node.expression;
            const args = options.updateArgs ? options.updateArgs(expression, j) : [];
            if (expression.type === 'CallExpression') {
                expression.callee.property = j.identifier(options.identifier);
                expression.arguments = args;
                cleanExpression(expression.callee);
            } else {
                expression.property = j.callExpression(j.identifier(options.identifier), args);
                cleanExpression(expression);
            }
        };
    }

    function findAndUpdate(source, options) {
        source.find(j.ExpressionStatement, options.searchOptions).forEach(update(options));
    }

    /** find the predefied statements and update */

    for (const mapping of mappings) {
        findAndUpdate(root, mapping);
    }

    // print
    return root.toSource();
}
