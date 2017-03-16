import detectQuoteStyle from '../utils/quote-style';
import { removeRequireAndImport } from '../utils/imports';
import proxyquireTransformer from '../utils/proxyquire';

const renaming = {
    toExist: 'toBeTruthy',
    toNotExist: 'toBeFalsy',
    toNotBe: 'not.toBe',
    toNotEqual: 'not.toEqual',
    toNotThrow: 'not.toThrow',
    toBeA: 'toBeInstanceOf',
    toBeAn: 'toBeInstanceOf',
    toNotBeA: 'not.toBeInstanceOf',
    toNotBeAn: 'not.toBeInstanceOf',
    toNotMatch: 'not.toMatch',
    toBeFewerThan: 'toBeLessThan',
    toBeLessThanOrEqualTo: 'toBeLessThanOrEqual',
    toBeMoreThan: 'toBeGreaterThan',
    toBeGreaterThanOrEqualTo: 'toBeGreaterThanOrEqual',
    toInclude: 'toContain',
    toExclude: 'not.toContain',
    toNotContain: 'not.toContain',
    toNotInclude: 'not.toContain',
    toNotHaveBeenCalled: 'not.toHaveBeenCalled',
};

const matchersToBe = new Set([
    'toBeA',
    'toBeAn',
    'toNotBeA',
    'toNotBeAn',
]);

const matchersWithKey = new Set([
    'toContainKey',
    'toExcludeKey',
    'toIncludeKey',
    'toNotContainKey',
    'toNotIncludeKey',
]);

const matchersWithKeys = new Set([
    'toContainKeys',
    'toExcludeKeys',
    'toIncludeKeys',
    'toNotContainKeys',
    'toNotIncludeKeys',
]);

export default function expectTransformer(fileInfo, api) {
    const j = api.jscodeshift;
    const ast = j(fileInfo.source);

    const expectFunctionName = removeRequireAndImport(j, ast, 'expect');

    if (!expectFunctionName) {
        // No expect require/import were found
        return fileInfo.source;
    }

    ast.find(j.MemberExpression, {
        object: {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: 'expect' },
        },
        property: { type: 'Identifier' },
    })
    .forEach(path => {
        const toBeArgs = path.parentPath.node.arguments;
        const expectArgs = path.node.object.arguments;
        const name = path.node.property.name;
        const isNot = name.indexOf('Not') !== -1 || name.indexOf('Exclude') !== -1;
        if (renaming[name]) {
            path.node.property.name = renaming[name];
        }

        if (matchersToBe.has(name)) {
            if (toBeArgs[0].type === 'Literal') {
                expectArgs[0] = j.unaryExpression('typeof', expectArgs[0]);
                path.node.property.name = isNot ? 'not.toBe' : 'toBe';
            }
        }

        if (matchersWithKey.has(name)) {
            expectArgs[0] = j.template.expression`Object.keys(${expectArgs[0]})`;
            path.node.property.name = isNot ? 'not.toContain' : 'toContain';
        }

        if (matchersWithKeys.has(name)) {
            toBeArgs[0] = j.identifier('e');
            path.node.property.name = isNot ? 'not.toContain' : 'toContain';
            j(path.parentPath).replaceWith(j.template.expression`\
${toBeArgs[0]}.forEach(${toBeArgs[0]} => {
  ${path.parentPath.node}
})`);
        }

        if (name === 'toMatch' || name === 'toNotMatch') {
            const arg = toBeArgs[0];
            if (arg.type === 'ObjectExpression') {
                path.node.property.name = isNot ? 'not.toMatchObject' : 'toMatchObject';
            }
        }
    });

    proxyquireTransformer(fileInfo, j, ast);

    const quote = detectQuoteStyle(j, ast) || 'single';
    return ast.toSource({ quote });
}
