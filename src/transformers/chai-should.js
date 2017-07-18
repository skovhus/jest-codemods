import {
    createCallUtil,
    chainContainsUtil,
    getNodeBeforeMemberExpressionUtil,
    updateExpectUtil,
    createCallChainUtil,
} from '../utils/chai-chain-utils';
import logger from '../utils/logger';
import { removeRequireAndImport } from '../utils/imports';
import { traverseMemberExpressionUtil } from '../utils/recast-helpers';
import finale from '../utils/finale';

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
    'lessthan',
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
    'extensible',
    'finite',
    'frozen',
    'sealed',
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
]);

const mapValueNameToObjectMethod = {
    extensible: 'isExtensible',
    frozen: 'isFrozen',
    sealed: 'isSealed',
};

export const assertPrefixes = new Set(['to', 'with', 'that']);

module.exports = function transformer(fileInfo, api, options) {
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

    const isExpectCall = node =>
        node.name === 'expect' ||
        (node.type === j.MemberExpression.name && isExpectCall(node.object)) ||
        (node.type === j.CallExpression.name && isExpectCall(node.callee));

    const isShouldMemberExpression = traverseMemberExpressionUtil(
        j,
        node => node.type === 'Identifier' && node.name === 'should'
    );

    const isExpectMemberExpression = traverseMemberExpressionUtil(
        j,
        node => node.type === j.CallExpression.name && node.callee.name === 'expect'
    );

    const logWarning = (msg, node) => logger(fileInfo, msg, node);

    const typeOf = (value, args, containsNot) => {
        switch (args[0].value) {
            case 'null':
                return createCall(
                    'toBeNull',
                    [],
                    updateExpect(value, node => node, containsNot)
                );
            case 'undefined':
                return createCall(
                    'toBeUndefined',
                    [],
                    updateExpect(value, node => node, containsNot)
                );
            case 'array':
                return createCall(
                    'toBe',
                    [j.booleanLiteral(containsNot ? false : true)],
                    updateExpect(value, node =>
                        j.callExpression(
                            j.memberExpression(
                                j.identifier('Array'),
                                j.identifier('isArray')
                            ),
                            [node]
                        )
                    )
                );
            default:
                return createCall(
                    'toBe',
                    args,
                    updateExpect(value, node => j.unaryExpression('typeof', node)),
                    containsNot
                );
        }
    };

    // TODO: not sure if this is even required for chai...
    // E.g. is should(x).true valid?
    const isPrefix = name => assertPrefixes.has(name);

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

    function getRestWithLengthHandled(p, rest) {
        const containsLength = chainContains('length', p.value.callee, isPrefix);
        return containsLength
            ? updateExpect(rest, node => j.memberExpression(node, j.identifier('length')))
            : rest;
    }

    function withIn(p, rest, args, containsNot) {
        if (args.length < 2) {
            logWarning(`.within needs at least two arguments`, p);
            return p.value;
        }

        j(p)
            .closest(j.ExpressionStatement)
            .insertBefore(
                j.expressionStatement(
                    createCall('toBeLessThanOrEqual', [args[0]], rest, containsNot)
                )
            );

        return createCall('toBeGreaterThanOrEqual', [args[1]], rest, containsNot);
    }

    const shouldChainedToExpect = () =>
        root
            .find(j.MemberExpression, {
                property: {
                    type: j.Identifier.name,
                    name: 'should',
                },
            })
            .replaceWith(p => j.callExpression(j.identifier('expect'), [p.node.object]))
            .size();

    const shouldIdentifierToExpect = () =>
        root
            .find(j.CallExpression)
            .filter(p => isShouldMemberExpression(p.value.callee))
            .replaceWith(p => {
                const { callee } = p.value;
                const [args0, args1] = p.node.arguments;

                const assertionNode = j.identifier(callee.property.name);
                const assertionPrefixNode = callee.object.property;
                const firstChainElement = assertionPrefixNode || assertionNode;

                let memberExpression = j.memberExpression(
                    j.callExpression(j.identifier('expect'), [args0]),
                    firstChainElement
                );

                if (assertionPrefixNode) {
                    // if there is a .not wrap it in another memberExpression
                    memberExpression = j.memberExpression(
                        memberExpression,
                        assertionNode
                    );
                }

                if (typeof args1 === 'undefined') {
                    return memberExpression;
                }

                return j.callExpression(memberExpression, [args1]);
            })
            .size();

    const updateMemberExpressions = () => {
        const getMembers = () =>
            root.find(j.MemberExpression, {
                property: {
                    name: name => members.indexOf(name.toLowerCase()) !== -1,
                },
            });

        getMembers().forEach(p => {
            if (p.parentPath.value.type === j.CallExpression.name) {
                p.parentPath.replace(p.value);
            }
        });

        return getMembers()
            .replaceWith(p => {
                const { value } = p;
                const rest = getAllBefore(isPrefix, value, 'should');
                const containsNot = chainContains('not', value, 'to');

                const propertyName = value.property.name.toLowerCase();

                switch (propertyName) {
                    case 'ok':
                        return containsNot
                            ? createCall('toBeFalsy', [], rest)
                            : createCall('toBeTruthy', [], rest);
                    case 'true':
                        return createCall(
                            'toBe',
                            [j.booleanLiteral(true)],
                            rest,
                            containsNot
                        );
                    case 'false':
                        return createCall(
                            'toBe',
                            [j.booleanLiteral(false)],
                            rest,
                            containsNot
                        );
                    case 'finite':
                        return createCall(
                            'toBe',
                            [j.booleanLiteral(!containsNot)],
                            updateExpect(value, node => {
                                return createCallChain(['isFinite'], [node]);
                            })
                        );
                    case 'extensible':
                    case 'frozen':
                    case 'sealed':
                        return createCall(
                            'toBe',
                            [j.booleanLiteral(!containsNot)],
                            updateExpect(value, node => {
                                return createCallChain(
                                    ['Object', mapValueNameToObjectMethod[propertyName]],
                                    [node]
                                );
                            })
                        );
                    case 'null':
                        return createCall('toBeNull', [], rest, containsNot);
                    case 'nan':
                        return createCall('toBeNaN', [], rest, containsNot);
                    case 'undefined':
                        return containsNot
                            ? createCall('toBeDefined', [], rest)
                            : createCall('toBeUndefined', [], rest);
                    case 'empty':
                        return createCall(
                            'toHaveLength',
                            [j.literal(0)],
                            updateExpect(value, node => {
                                if (
                                    node.type === j.ObjectExpression.name ||
                                    node.type === j.Identifier.name
                                ) {
                                    return createCallChain(['Object', 'keys'], [node]);
                                }
                                return node;
                            }),
                            containsNot
                        );
                    case 'exist':
                    case 'defined':
                        return containsNot
                            ? createCall('toBeFalsy', [], rest)
                            : createCall('toBeDefined', [], rest);
                    default:
                        return value;
                }
            })
            .size();
    };

    const updateCallExpressions = () =>
        root
            .find(j.CallExpression, {
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

                const restRaw = getAllBefore(isPrefix, value.callee, 'should');
                const rest = getRestWithLengthHandled(p, restRaw);
                const containsNot = chainContains('not', value.callee, isPrefix);
                const containsDeep = chainContains('deep', value.callee, isPrefix);
                const containsAny = chainContains('any', value.callee, isPrefix);
                const args = value.arguments;

                switch (p.value.callee.property.name.toLowerCase()) {
                    case 'equal':
                        return containsDeep
                            ? createCall('toEqual', args, rest, containsNot)
                            : createCall('toBe', args, rest, containsNot);
                    case 'throw':
                        return createCall('toThrowError', args, rest, containsNot);
                    case 'include':
                    case 'string':
                    case 'contain':
                        if (
                            args.length === 1 && args[0].type === j.ObjectExpression.name
                        ) {
                            return createCall('toMatchObject', args, rest, containsNot);
                        }
                        return createCall('toContain', args, rest, containsNot);
                    case 'eql':
                        return createCall('toEqual', args, rest, containsNot);
                    case 'above':
                        return createCall('toBeGreaterThan', args, rest, containsNot);
                    case 'least':
                    case 'gte':
                        return createCall(
                            'toBeGreaterThanOrEqual',
                            args,
                            rest,
                            containsNot
                        );
                    case 'below':
                    case 'lessthan':
                        return createCall('toBeLessThan', args, rest, containsNot);
                    case 'most':
                    case 'lte':
                        return createCall('toBeLessThanOrEqual', args, rest, containsNot);
                    case 'within':
                        return withIn(p, rest, args, containsNot);
                    case 'match':
                        return createCall('toMatch', args, rest, containsNot);
                    case 'members':
                        if (chainContains('ordered', value.callee, isPrefix)) {
                            logWarning('Unsupported Chai Assertion "ordered"', p);
                        }

                        return createCall(
                            'toEqual',
                            args.map(containing),
                            rest,
                            containsNot
                        );
                    case 'keys':
                        if (containsAny) {
                            logWarning('Unsupported Chai Assertion "any.keys"', p);
                            return value;
                        }
                        return createCall(
                            'toEqual',
                            [
                                createCallChain(
                                    ['expect', 'arrayContaining'],
                                    parseArgs(args)
                                ),
                            ],
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
                        return createCall('toBeInstanceOf', args, rest, containsNot);
                    case 'instanceof':
                        return createCall('toBeInstanceOf', args, rest, containsNot);
                    case 'length':
                    case 'lengthof':
                        return createCall('toHaveLength', args, restRaw, containsNot);
                    case 'property':
                        return createCall('toHaveProperty', args, rest, containsNot);
                    case 'ownproperty':
                        return createCall(
                            'toBeTruthy',
                            [],
                            updateExpect(value, node =>
                                j.callExpression(
                                    j.memberExpression(
                                        node,
                                        j.identifier('hasOwnProperty')
                                    ),
                                    [args[0]]
                                )
                            )
                        );
                    case 'ownpropertydescriptor':
                        return args.length === 1
                            ? createCall(
                                  'toBeUndefined',
                                  [],
                                  updateExpect(value, node =>
                                      j.callExpression(
                                          j.memberExpression(
                                              j.identifier('Object'),
                                              j.identifier('getOwnPropertyDescriptor')
                                          ),
                                          [node, args[0]]
                                      )
                                  ),
                                  true
                              )
                            : createCall(
                                  'toEqual',
                                  [args[1]],
                                  updateExpect(value, node =>
                                      j.callExpression(
                                          j.memberExpression(
                                              j.identifier('Object'),
                                              j.identifier('getOwnPropertyDescriptor')
                                          ),
                                          [node, args[0]]
                                      )
                                  )
                              );
                    default:
                        return value;
                }
            })
            .size();

    mutations += shouldChainedToExpect();
    mutations += shouldIdentifierToExpect();
    mutations += updateCallExpressions();
    mutations += updateMemberExpressions();

    root
        .find(j.MemberExpression, {
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

    return finale(fileInfo, j, root, options);
};
