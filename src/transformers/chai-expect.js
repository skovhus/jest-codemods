
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
            object = object.object;
            containingNot = (object.property || {}).name === 'not';
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

    function update(p) {
        console.log(p.node.callee.property.name);
        p.node.callee.property = j.identifier(mappings[p.node.callee.property.name]);
        p.node.callee.object = p.node.callee.object.object;
    }

    function updateExist(p) {
        const expression = p.node.expression;
        p.node.expression.property = j.callExpression(j.identifier('toEqual'), [j.callExpression(j.identifier('anything'), [])]);
        cleanExpression(expression);
    }

    function updateNull(p) {
        const expression = p.node.expression;
        expression.property = j.callExpression(j.identifier('toBeNull'), []);
        cleanExpression(expression);
    }

    function updateUndefined(p) {
        const expression = p.node.expression;
        expression.property = j.callExpression(j.identifier('toBeUndefined'), []);
        cleanExpression(expression);
    }

    function updateTrue(p) {
        const expression = p.node.expression;
        expression.property = j.callExpression(j.identifier('toBeTruthy'), []);
        cleanExpression(expression);
    }

    function updateCloseTo(p) {
        const callExpression = p.node.expression;
        const callee = callExpression.callee;
        callee.property = j.identifier('toBeCloseTo');

        const args = callExpression.arguments;
        const digits = (args[1].raw.toString().split('.')[1] || '').length.toString();
        callExpression.arguments = [args[0], digits];

        cleanExpression(callee);
    }

    function updateToBeFalse(p) {
        const expression = p.node.expression;
        expression.property = j.callExpression(j.identifier('toBeFalsy'), []);
        cleanExpression(expression);
    }

    function updateAbove(p) {
        const callExpression = p.node.expression;
        const callee = callExpression.callee;
        callee.property = j.identifier('toBeGreaterThan');
        cleanExpression(callee);
    }

    function updateLeast(p) {
        const callExpression = p.node.expression;
        const callee = callExpression.callee;
        callee.property = j.identifier('toBeGreaterThanOrEqual');
        cleanExpression(callee);
    }

    function updateBelow(p) {
        const callExpression = p.node.expression;
        const callee = callExpression.callee;
        callee.property = j.identifier('toBeLessThan');
        cleanExpression(callee);
    }

    function updateMost(p) {
        const callExpression = p.node.expression;
        const callee = callExpression.callee;
        callee.property = j.identifier('toBeLessThanOrEqual');
        cleanExpression(callee);
    }

    function updateInstanceOf(p) {
        const callExpression = p.node.expression;
        const callee = callExpression.callee;
        callee.property = j.identifier('toBeInstanceOf');
        cleanExpression(callee);
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

    // find and update all null statements:
    root.find(j.ExpressionStatement, {
        expression: { property: { name: 'null' } },
    }).forEach(updateNull);

    // find and update all undefined statements:
    root.find(j.ExpressionStatement, {
        expression: { property: { name: 'undefined' } },
    }).forEach(updateUndefined);

    // find and update all true statements:
    root.find(j.ExpressionStatement, {
        expression: { property: { name: 'true' } },
    }).forEach(updateTrue);

    // find and update all closeTo statements:
    root.find(j.ExpressionStatement, {
        expression: { callee: { property: { name: 'closeTo' } } },
    }).forEach(updateCloseTo);

    // find and update all to.be.false statements:
    root.find(j.ExpressionStatement, {
        expression: { property: { name: 'false' } },
    }).forEach(updateToBeFalse);

    // find and update all ablove statements:
    root.find(j.ExpressionStatement, {
        expression: { callee: { property: { name: 'above' } } },
    }).forEach(updateAbove);

    // find and update all ablove statements:
    root.find(j.ExpressionStatement, {
        expression: { callee: { property: { name: 'least' } } },
    }).forEach(updateLeast);

    // find and update all below statements:
    root.find(j.ExpressionStatement, {
        expression: { callee: { property: { name: 'below' } } },
    }).forEach(updateBelow);

    // find and update all most statements:
    root.find(j.ExpressionStatement, {
        expression: { callee: { property: { name: 'most' } } },
    }).forEach(updateMost);

    // find and update all instanceof statements:
    root.find(j.ExpressionStatement, {
        expression: { callee: { property: { name: 'instanceof' } } },
    }).forEach(updateInstanceOf);

    // print
    return root.toSource();
}
