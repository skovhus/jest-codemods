import detectQuoteStyle from '../utils/quote-style';

const methodMap = {
    suite: 'describe',
    context: 'describe',
    specify: 'it',
    test: 'it',
    before: 'beforeAll',
    beforeEach: 'beforeEach',
    setup: 'beforeEach',
    after: 'afterAll',
    afterEach: 'afterEach',
    teardown: 'afterEach',
    suiteSetup: 'beforeAll',
    suiteTeardown: 'afterAll',
};

const jestMethodsWithDescriptionsAllowed = new Set(['it', 'describe']);

const methodModifiers = ['only', 'skip'];

export default function mochaToJest(file, api) {
    const j = api.jscodeshift;
    const ast = j(file.source);

    Object.keys(methodMap).forEach(mochaMethod => {
        const jestMethod = methodMap[mochaMethod];

        ast.find(j.CallExpression, {
            type: 'CallExpression',
            callee: { type: 'Identifier', name: mochaMethod },
        }).replaceWith(path => {
            let args = path.value.arguments;
            if (!jestMethodsWithDescriptionsAllowed.has(jestMethod)) {
                args = args.filter(a => a.type !== 'Literal');
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
            }).replaceWith(path => j.callExpression(j.memberExpression(
                j.identifier(jestMethod),
                j.identifier(modifier)
            ), path.value.arguments));
        });
    });

    // As Recast is not preserving original quoting, we try to detect it,
    // and default to something sane.
    const quote = detectQuoteStyle(j, ast) || 'single';
    return ast.toSource({ quote });
}
