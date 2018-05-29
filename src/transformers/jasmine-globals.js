/**
 * Codemod for transforming Jasmine `this` context into Jest v20+ compatible syntax.
 */

import finale from '../utils/finale';

export default function jasmineGlobals(fileInfo, api, options) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    const emptyArrowFn = j('() => {}').__paths[0].value.program.body[0].expression;

    root
        // find all global `spyOn` calls that are standalone expressions.
        // e.g.
        // spyOn(stuff)
        // but not
        // spyOn(stuff).and.callThrough();
        .find(j.ExpressionStatement, {
            expression: {
                type: 'CallExpression',
                callee: {
                    type: 'Identifier',
                    name: 'spyOn',
                },
            },
        })
        .forEach(path => {
            path.node.expression = j.callExpression(
                j.memberExpression(
                    path.node.expression,
                    // add .mockImplementation(() => {}); call
                    // because jasmine spy's default is to mock the return value,
                    // whereas jest calls through by default.
                    j.identifier('mockImplementation')
                ),
                [emptyArrowFn]
            );
        });

    root
        // find spyOn().and.*() expressions
        .find(j.CallExpression, {
            callee: {
                type: 'MemberExpression',
                object: {
                    type: 'MemberExpression',
                    property: { name: 'and' },
                    object: {
                        type: 'CallExpression',
                        callee: {
                            type: 'Identifier',
                            name: 'spyOn',
                        },
                    },
                },
            },
        })
        .forEach(path => {
            const spyType = path.node.callee.property.name;
            switch (spyType) {
                // if it's `spyOn().and.callThrough()`
                // we should remove it and make just `spyOn()`
                // because jest calls through by default
                case 'callThrough': {
                    const callee = path.node.callee.object.object.callee;
                    const arg = path.node.callee.object.object.arguments;
                    path.node.callee = callee;
                    path.node.arguments = arg;
                    break;
                }
                // if it's `spyOn().and.callFake()` replace with jest's
                // equivalent `spyOn().mockImplementation();
                case 'callFake': {
                    path.node.callee.object = path.node.callee.object.object;
                    path.node.callee.property.name = 'mockImplementation';
                    break;
                }
                // `spyOn().and.returnValue()` is equivalent of
                // `jest.spyOn().mockReturnValue()`
                case 'returnValue': {
                    path.node.callee.object = path.node.callee.object.object;
                    path.node.callee.property.name = 'mockReturnValue';
                    break;
                }
            }
        });

    root
        //   find all `SpyOn` calls
        .find(j.CallExpression, {
            callee: { type: 'Identifier', name: 'spyOn' },
        })
        .forEach(path => {
            // and make them `jest.spyOn()`
            path.node.callee = j.memberExpression(
                j.identifier('jest'),
                j.identifier('spyOn')
            );
        });

    root
        // find all `*.calls.count()`
        .find(j.CallExpression, {
            callee: {
                type: 'MemberExpression',
                property: { type: 'Identifier', name: 'count' },
                object: {
                    type: 'MemberExpression',
                    property: { type: 'Identifier', name: 'calls' },
                },
            },
        })
        .forEach(path => {
            // replace `.count()` with `.length`
            path.node.callee.property.name = 'length';
            // add extra `.mock` property that jest uses:
            //   stuff.calls.count() -> stuff.mock.calls.length
            path.node.callee.object.object = j.memberExpression(
                path.node.callee.object.object,
                j.identifier('mock')
            );
            j(path).replaceWith(path.node.callee);
        });

    return finale(fileInfo, j, root, options);
}
