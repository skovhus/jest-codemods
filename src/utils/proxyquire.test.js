/* eslint-env jest */
import jscodeshift from 'jscodeshift';

import proxyquireTransformer from './proxyquire';

const mockedLogger = jest.fn();
jest.mock('./logger', () => () => mockedLogger(...arguments));
const j = jscodeshift;
const fileInfo = { path: 'a.test.js' };

it('rewrites proxyquire without noCallThru', () => {
    const ast = j(`
        import proxyquire from 'proxyquire';
        const { mapStateToProps, default: Page } = proxyquire('./PageContainer', {
            './features/baz': () => <div />,
            'common/Foo': () => <div />,
        });
    `);
    proxyquireTransformer(fileInfo, j, ast);
    expect(ast.toSource({ quote: 'single' })).toEqual(`
        jest.mock('./features/baz', () => () => <div />);
        jest.mock('common/Foo', () => () => <div />);
        const { mapStateToProps, default: Page } = require('./PageContainer');
    `);
    expect(mockedLogger).not.toBeCalled();
});

it('rewrites proxyquire with noCallThru', () => {
    const ast = j(`
        import proxyquire from 'proxyquire';
        const Page = proxyquire.noCallThru()('./PageContainer', {
            'common/Foo': () => <div />,
        });
    `);
    proxyquireTransformer(fileInfo, j, ast);
    expect(ast.toSource({ quote: 'single' })).toEqual(`
        jest.mock('common/Foo', () => () => <div />);
        const Page = require('./PageContainer');
    `);
    expect(mockedLogger).not.toBeCalled();
});

it('rewrites proxyquire with require statement noCallThru', () => {
    const ast = j(`
        const proxyquireStrict = require('proxyquire').noCallThru();
        const tracking = proxyquireStrict('./tracking', {
            'lib': () => {},
        });
    `);
    proxyquireTransformer(fileInfo, j, ast);
    expect(ast.toSource({ quote: 'single' })).toEqual(`
        jest.mock('lib', () => () => {});
        const tracking = require('./tracking');
    `);
    expect(mockedLogger).not.toBeCalled();
});

it('supports variable reference object', () => {
    const ast = j(`
        import proxyquire from 'proxyquire';
        import sinon from 'sinon';

        const mockedDeps = {
             'react-dom': {
                 render: sinon.spy(() => {}),
             },
        };

        proxyquire.noCallThru()('./index', mockedDeps);

        test('renders', t => {
            t.true(mockedDeps['react-dom'].render.calledOnce, 'render is called');
            t.end();
        });
    `);
    proxyquireTransformer(fileInfo, j, ast);
    expect(ast.toSource({ quote: 'single' })).toEqual(`
        import sinon from 'sinon';

        const mockedDeps = {
             'react-dom': {
                 render: sinon.spy(() => {}),
             },
        };

        jest.mock('react-dom', () => mockedDeps['react-dom']);

        require('./index');

        test('renders', t => {
            t.true(mockedDeps['react-dom'].render.calledOnce, 'render is called');
            t.end();
        });
    `);
    expect(mockedLogger).not.toBeCalled();
});

it('logs error when proxyquire mocks are not defined in the file', () => {
    // TODO: this is kind of a bad state, but also a funny usage of proxyquire
    const ast = j(`
        import proxyquire from 'proxyquire';
        import mockedDeps from './someFile';
        proxyquire.noCallThru()('./index', mockedDeps);
    `);
    proxyquireTransformer(fileInfo, j, ast);
    expect(ast.toSource({ quote: 'single' })).toEqual(`
        import mockedDeps from './someFile';
        proxyquire.noCallThru()('./index', mockedDeps);
    `);
    expect(mockedLogger).toBeCalled();
});

it('logs error when type of mock is not known', () => {
    const ast = j(`
        import proxyquire from 'proxyquire';
        proxyquire.noCallThru()('./index', () => {});
    `);
    proxyquireTransformer(fileInfo, j, ast);
    expect(mockedLogger).toBeCalled();
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
    proxyquireTransformer(fileInfo, j, ast);
    expect(ast.toSource({ quote: 'single' })).toEqual(`
        jest.mock('../page', () => mockedRender);
        const routeHandler = require('./handler');
        const failingRouteHandler = proxyquire.noCallThru()('./handler', {
            '../page': mockedFailingRender,
        });
    `);
    expect(mockedLogger).toBeCalled();
});
