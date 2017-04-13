import {
    createCallUtil,
    chainContainsUtil,
    getNodeBeforeMemberExpressionUtil,
    updateExpectUtil,
    createCallChainUtil,
} from '../utils/chai-chain-utils';
import logger from '../utils/logger';
import { removeRequireAndImport } from '../utils/imports';
import detectQuoteStyle from '../utils/quote-style';

const fns = [
    'keys',
    'a',
    'an',
    'instanceof',
    'lengthof',
    'length',
    'equal',
    'throw',
    'include',
    'contain',
    'eql',
    'above',
    'least',
    'below',
    'most',
    'match',
    'string',
    'members',
    'property',
    'ownproperty',
    'ownpropertydescriptor',
    'gte',
    'lte',
    'within',
];

const members = [
    'ok',
    'true',
    'false',
    'null',
    'undefined',
    'exist',
    'empty',
    'nan',
    'defined',
];

const unsupportedProperties = new Set([
    'arguments',
    'respondTo',
    'satisfy',
    'closeTo',
    'oneOf',
    'change',
    'increase',
    'decrease',
    'extensible',
    'sealed',
    'frozen',
]);

module.exports = function transformer(fileInfo, api) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);
    let mutations = 0;

    const createCall = createCallUtil(j);
    const chainContains = chainContainsUtil(j);
    const getAllBefore = getNodeBeforeMemberExpressionUtil(j);
    const updateExpect = updateExpectUtil(j);
    const createCallChain = createCallChainUtil(j);

    removeRequireAndImport(j, root, 'chai', 'expect');
    removeRequireAndImport(j, root, 'chai', 'should');
    // Not sure if expect is always imported... So we continue with the transformation:

    const isExpectCall = node => (
        node.name === 'expect' ||
        (node.type === j.MemberExpression.name && isExpectCall(node.object)) ||
        (node.type === j.CallExpression.name && isExpectCall(node.callee))
    );

    const isExpectMemberExpression = node => {
        if (!node) {
            return false;
        }

        if (node.type === j.CallExpression.name && node.callee.name === 'expect') {
            return true;
        }

        return isExpectMemberExpression(node.object);
    };

    const logWarning = (msg, node) => logger(fileInfo, msg, node);

    const typeOf = (value, args, containsNot) => {
        switch (args[0].value) {
            case 'null':
                return createCall('toBeNull', [], updateExpect(value, node => node, containsNot));
            case 'undefined':
                return createCall('toBeUndefined', [], updateExpect(value, node => node, containsNot));
            default:
                return createCall('toBe', args,
            updateExpect(value, node => j.unaryExpression('typeof', node)), containsNot);
        }
    };

    const isPrefix = name => (['to', 'with', 'that'].indexOf(name) !== -1);

    function parseArgs(args) {
        if (args.length === 1 && args[0].type === j.ObjectExpression.name) {
            return [createCallChain(['Object', 'keys'], args)];
        } else if (args.length > 1) {
            return [j.arrayExpression(args)];
        }

        return args;
    }

    function containing(node) {
        switch (node.type) {
            case j.ArrayExpression.name:
                return createCallChain(['expect', 'arrayContaining'], [node]);
            case j.ObjectExpression.name:
                return createCallChain(['expect', 'objectContaining'], [node]);
            default:
                return node;
        }
    }

    function withIn(p, rest, args, containsNot) {
        if (args.length !== 2) {
            console.warn(`.withIn needs two arguments, you passed ${args.length}`);
            return p;
        }

        const containsLength = chainContains('length', p.value.callee, isPrefix);
        const expect = () => (
            containsLength ?
                updateExpect(rest, node => j.memberExpression(node, j.identifier('length')))
                :
                rest
        );

        j(p).closest(j.ExpressionStatement).insertBefore(
            j.expressionStatement(
                createCall('toBeLessThanOrEqual', [args[0]], expect(), containsNot)
            )
        );

        return createCall('toBeGreaterThanOrEqual', [args[1]], expect(), containsNot);
    }

    const shouldToExpect = () =>
        root.find(j.MemberExpression, {
            property: {
                type: j.Identifier.name,
                name: 'should',
            },
        })
        .replaceWith(p => j.callExpression(j.identifier('expect'), [p.node.object]))
        .size();

    const updateMemberExpressions = () =>
        root.find(j.MemberExpression, {
            property: {
                name: name => members.indexOf(name.toLowerCase()) !== -1,
            },
        }).replaceWith(p => {
            const { value } = p;
            const rest = getAllBefore(isPrefix, value, 'should');
            const containsNot = chainContains('not', value, 'to');

            switch (value.property.name.toLowerCase()) {
                case 'ok':
                    return containsNot ?
                        createCall('toBeFalsy', [], rest)
                        :
                        createCall('toBeTruthy', [], rest);
                case 'true':
                    return createCall('toBe', [j.booleanLiteral(true)], rest, containsNot);
                case 'false':
                    return createCall('toBe', [j.booleanLiteral(false)], rest, containsNot);
                case 'null':
                    return createCall('toBeNull', [], rest, containsNot);
                case 'nan':
                    return createCall('toBeNaN', [], rest, containsNot);
                case 'undefined':
                    return containsNot ?
                        createCall('toBeDefined', [], rest)
                        :
                        createCall('toBeUndefined', [], rest);
                case 'empty':
                case 'exist':
                case 'defined':
                    return containsNot ?
                        createCall('toBeFalsy', [], rest)
                        :
                        createCall('toBeDefined', [], rest);
                default:
                    return value;
            }
        })
        .size();

    const updateCallExpressions = () =>
        root.find(j.CallExpression, {
            callee: {
                type: j.MemberExpression.name,
                property: {
                    name: name => fns.indexOf(name.toLowerCase()) !== -1,
                },
                object: isExpectCall,
            },
        })
        .replaceWith(p => {
            const { value } = p;
            const rest = getAllBefore(isPrefix, value.callee, 'should');
            const containsNot = chainContains('not', value.callee, isPrefix);
            const containsDeep = chainContains('deep', value.callee, isPrefix);
            const containsAny = chainContains('any', value.callee, isPrefix);
            const args = value.arguments;

            switch (p.value.callee.property.name.toLowerCase()) {
                case 'equal':
                    return containsDeep ?
                        createCall('toEqual', args, rest, containsNot)
                        :
                        createCall('toBe', args, rest, containsNot);
                case 'throw':
                    return createCall('toThrowError', args, rest, containsNot);
                case 'include':
                case 'string':
                case 'contain':
                    if (args.length === 1 && args[0].type === j.ObjectExpression.name) {
                        return createCall('toMatchObject', args, rest, containsNot);
                    }
                    return createCall('toContain', args, rest, containsNot);
                case 'eql':
                    return createCall('toEqual', args, rest, containsNot);
                case 'above':
                    return createCall('toBeGreaterThan', args, rest, containsNot);
                case 'least':
                case 'gte':
                    return createCall('toBeGreaterThanOrEqual', args, rest, containsNot);
                case 'below':
                    return createCall('toBeLessThan', args, rest, containsNot);
                case 'most':
                case 'lte':
                    return createCall('toBeLessThanOrEqual', args, rest, containsNot);
                case 'within':
                    return withIn(p, rest, args, containsNot);
                case 'match':
                    return createCall('toMatch', args, rest, containsNot);
                case 'members':
                    return createCall('toEqual', args.map(containing), rest, containsNot);
                case 'keys':
                    if (containsAny) {
                        logWarning('Unsupported Chai Assertion "any.keys"', p);
                        return value;
                    }
                    return createCall(
                          'toEqual',
                          [createCallChain(['expect', 'arrayContaining'], parseArgs(args))],
                          updateExpect(value, node => {
                              if (node.type === j.ObjectExpression.name) {
                                  return createCallChain(['Object', 'keys'], [node]);
                              }
                              return node;
                          }),
                          containsNot
                    );
                case 'a':
                case 'an':
                    if (!args.length) {
                        return value;
                    }
                    if (args[0].type === 'Literal') {
                        return typeOf(value, args, containsNot);
                    }
                    return createCall(
                          'toBe',
                          [j.booleanLiteral(true)],
                          updateExpect(value, node => j.binaryExpression('instanceof', node, args[0])),
                          containsNot
                      );
                case 'instanceof':
                    return createCall(
                          'toBeInstanceOf',
                          args,
                          rest,
                          containsNot
                      );
                case 'length':
                case 'lengthof':
                    return createCall(
                          'toHaveLength',
                          args,
                          rest,
                          containsNot
                      );
                case 'property':
                    return createCall(
                        'toHaveProperty',
                        args,
                        rest,
                        containsNot,
                    );
                case 'ownproperty':
                    return createCall(
                          'toBeTruthy',
                          [],
                          updateExpect(value, node => j.callExpression(
                              j.memberExpression(node, j.identifier('hasOwnProperty')),
                              [args[0]]
                          )
                      )
                  );
                case 'ownpropertydescriptor':
                    return args.length === 1 ?
                          createCall(
                              'toBeUndefined',
                              [],
                              updateExpect(value, node => j.callExpression(
                                  j.memberExpression(
                                      j.identifier('Object'), j.identifier('getOwnPropertyDescriptor')),
                                      [node, args[0]]
                                  )
                              ),
                              true
                          )
                          :
                          createCall(
                              'toEqual',
                              [args[1]],
                              updateExpect(value, node => j.callExpression(
                                  j.memberExpression(
                                      j.identifier('Object'), j.identifier('getOwnPropertyDescriptor')
                                  ),
                                  [node, args[0]]
                              ))
                          );
                default:
                    return value;
            }
        })
        .size();

    mutations += shouldToExpect();
    mutations += updateCallExpressions();
    mutations += updateMemberExpressions();

    root.find(j.MemberExpression, {
        property: {
            name: name => unsupportedProperties.has(name),
        },
    })
    .filter(p => isExpectMemberExpression(p.value))
    .forEach(p => {
        const assertion = p.value.property.name;
        logWarning(`Unsupported Chai Assertion "${assertion}"`, p);
    });

    if (!mutations) {
        return null;
    }

    const quote = detectQuoteStyle(j, root) || 'single';
    return root.toSource({ quote });
};
