import { removeRequireAndImport } from '../utils/imports';
import finale from '../utils/finale';
import jasmineThisTransformer from './jasmine-this';

const methodMap = {
    suite: 'describe',
    context: 'describe',
    specify: 'test',
    test: 'test',
    it: 'test',
    before: 'beforeAll',
    beforeEach: 'beforeEach',
    setup: 'beforeEach',
    after: 'afterAll',
    afterEach: 'afterEach',
    teardown: 'afterEach',
    suiteSetup: 'beforeAll',
    suiteTeardown: 'afterAll',
};

const jestMethodsWithDescriptionsAllowed = new Set(['test', 'describe']);

const methodModifiers = ['only', 'skip'];

function hasBinding(name, scope) {
    if (!scope) {
        return false;
    }

    const bindings = Object.keys(scope.getBindings()) || [];
    if (bindings.indexOf(name) >= 0) {
        return true;
    }

    return scope.isGlobal ? false : hasBinding(name, scope.parent);
}

export default function mochaToJest(fileInfo, api, options) {
    const j = api.jscodeshift;
    const ast = j(fileInfo.source);

    removeRequireAndImport(j, ast, 'mocha');

    Object.keys(methodMap).forEach(mochaMethod => {
        const jestMethod = methodMap[mochaMethod];

        ast.find(j.CallExpression, {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: mochaMethod },
        })
            .filter(({ scope }) => !hasBinding(mochaMethod, scope))
            .replaceWith(path => {
                let args = path.value.arguments;
                if (!jestMethodsWithDescriptionsAllowed.has(jestMethod)) {
                    args = args.filter(a => a.type !== 'Literal');
                } else if (args.length === 1 && args[0].type === 'Literal') {
                    const emptyArrowFunction = j.arrowFunctionExpression(
                        [],
                        j.blockStatement([j.emptyStatement()])
                    );
                    return j.callExpression(
                        j.memberExpression(
                            j.identifier(jestMethod),
                            j.identifier('skip')
                        ),
                        args.concat([emptyArrowFunction])
                    );
                }
                return j.callExpression(j.identifier(jestMethod), args);
            });

        methodModifiers.forEach(modifier => {
            ast.find(j.CallExpression, {
                type: 'CallExpression',
                callee: {
                    type: 'MemberExpression',
                    object: { type: 'Identifier', name: mochaMethod },
                    property: { type: 'Identifier', name: modifier },
                },
            }).replaceWith(path =>
                j.callExpression(
                    j.memberExpression(j.identifier(jestMethod), j.identifier(modifier)),
                    path.value.arguments
                )
            );
        });
    });

    fileInfo.source = finale(fileInfo, j, ast, options);

    const transformedSource = jasmineThisTransformer(fileInfo, api, options);
    if (transformedSource) {
        fileInfo.source = transformedSource;
    }

    return fileInfo.source;
}
