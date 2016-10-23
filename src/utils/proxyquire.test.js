/* eslint-env jest */
import jscodeshift from 'jscodeshift';

import proxyquireTransformer from './proxyquire';

const j = jscodeshift;

it('rewrites proxyquire without noCallThru', () => {
    const ast = j(`
        import proxyquire from 'proxyquire';
        const { mapStateToProps, default: Page } = proxyquire('./PageContainer', {
            './features/baz': () => <div />,
            'common/Foo': () => <div />,
        });
    `);
    proxyquireTransformer(j, ast);
    expect(ast.toSource({ quote: 'single' })).toEqual(`
        jest.mock('./features/baz', () => () => <div />);
        jest.mock('common/Foo', () => () => <div />);
        const { mapStateToProps, default: Page } = require('./PageContainer');
    `);
});

it('rewrites proxyquire with noCallThru', () => {
    const ast = j(`
        import proxyquire from 'proxyquire';
        const Page = proxyquire.noCallThru()('./PageContainer', {
            'common/Foo': () => <div />,
        });
    `);
    proxyquireTransformer(j, ast);
    expect(ast.toSource({ quote: 'single' })).toEqual(`
        jest.mock('common/Foo', () => () => <div />);
        const Page = require('./PageContainer');
    `);
});

it('rewrites proxyquire with require statement noCallThru', () => {
    const ast = j(`
        const proxyquireStrict = require('proxyquire').noCallThru();
        const tracking = proxyquireStrict('./tracking', {
            'lib': () => {},
        });
    `);
    proxyquireTransformer(j, ast);
    expect(ast.toSource({ quote: 'single' })).toEqual(`
        jest.mock('lib', () => () => {});
        const tracking = require('./tracking');
    `);
});

it('logs error with multiple proxyquire to same file', () => {
    const ast = j(`
        import proxyquire from 'proxyquire';
        const routeHandler = proxyquire.noCallThru()('./handler', {
            '../page': mockedRender,
        });
        const failingRouteHandler = proxyquire.noCallThru()('./handler', {
            '../page': mockedFailingRender,
        });
    `);
    proxyquireTransformer(j, ast);
    expect(ast.toSource({ quote: 'single' })).toEqual(`
        import proxyquire from 'proxyquire';
        const routeHandler = proxyquire.noCallThru()('./handler', {
            '../page': mockedRender,
        });
        const failingRouteHandler = proxyquire.noCallThru()('./handler', {
            '../page': mockedFailingRender,
        });
    `);
});
