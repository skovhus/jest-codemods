import { removeRequireAndImport } from '../utils/imports';
import { traverseMemberExpressionUtil } from '../utils/recast-helpers';
import detectQuoteStyle from '../utils/quote-style';
import detectLineTerminator from '../utils/line-terminator';

import chaiShouldTransformer from './chai-should';

const assertionRemappings = {
    throws: 'throw',
};

module.exports = function transformer(fileInfo, api, options) {
    const j = api.jscodeshift;
    const root = j(fileInfo.source);

    const isShouldMemberExpression = traverseMemberExpressionUtil(
        j,
        node =>
            (node.type === j.CallExpression.name && node.callee.name === 'should') ||
            (node.type === j.Identifier.name && node.name === 'should')
    );

    /**
     * Injects missing to prefixes expected by chai-should transformer.
     * TODO: not sure if this is even required for chai...
     */
    function injectMissingPrefix() {
        const injector = p => {
            const { property } = p.parentPath.value;
            if (property && property.type === j.Identifier.name) {
                if (property.name !== 'to') {
                    const newPath = j.memberExpression(p.value, j.identifier('to'));
                    p.replace(newPath);
                }
            }
        };

        root
            .find(j.CallExpression, {
                callee: {
                    name: name => ['expect', 'should'].indexOf(name) >= 0,
                },
            })
            .forEach(injector);

        root
            .find(j.MemberExpression, {
                property: {
                    type: j.Identifier.name,
                    name: 'should',
                },
            })
            .forEach(injector);
    }

    function renameShouldCallExpressions() {
        root
            .find(j.CallExpression, {
                callee: {
                    name: 'should',
                },
            })
            .forEach(p => {
                p.value.callee.name = 'expect';
            });
    }

    function remapAssertions() {
        root
            .find(j.MemberExpression, {
                property: {
                    name: name => Object.keys(assertionRemappings).indexOf(name) >= 0,
                },
            })
            .filter(p => isShouldMemberExpression(p.value))
            .forEach(p => {
                const { property } = p.value;
                property.name = assertionRemappings[property.name];
            });
    }

    removeRequireAndImport(j, root, 'should');
    injectMissingPrefix();
    renameShouldCallExpressions();
    remapAssertions();

    const quote = detectQuoteStyle(j, root) || 'single';
    const lineTerminator = detectLineTerminator(fileInfo.source);
    fileInfo.source = root.toSource({ quote, lineTerminator });

    return chaiShouldTransformer(fileInfo, api, options);
};
