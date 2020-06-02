/* eslint-env jest */
import jscodeshift from 'jscodeshift'

import proxyquireTransformer from './proxyquire'

const mockedLogger = jest.fn()
jest.mock('./logger', () => (args) => mockedLogger(args))
const j = jscodeshift
const fileInfo = { path: 'a.test.js' }

const getOptions = () => ({ quote: 'single', lineTerminator: '\n' } as const)

it('rewrites proxyquire without noCallThru', () => {
  const ast = j(`
        import proxyquire from 'proxyquire';
        const { mapStateToProps, default: Page } = proxyquire('./PageContainer', {
            './features/baz': () => <div />,
            'common/Foo': () => <div />,
        });
    `)
  proxyquireTransformer(fileInfo, j, ast)
  expect(ast.toSource(getOptions())).toEqual(`
        jest.mock('./features/baz', () => () => <div />);
        jest.mock('common/Foo', () => () => <div />);
        const { mapStateToProps, default: Page } = require('./PageContainer');
    `)
  expect(mockedLogger).not.toHaveBeenCalled()
})

it('rewrites proxyquire with noCallThru', () => {
  const ast = j(`
        import proxyquire from 'proxyquire';
        const Page = proxyquire.noCallThru()('./PageContainer', {
            'common/Foo': () => <div />,
        });
    `)
  proxyquireTransformer(fileInfo, j, ast)
  expect(ast.toSource(getOptions())).toEqual(`
        jest.mock('common/Foo', () => () => <div />);
        const Page = require('./PageContainer');
    `)
  expect(mockedLogger).not.toHaveBeenCalled()
})

it('rewrites proxyquire with require statement noCallThru', () => {
  const ast = j(`
        const proxyquireStrict = require('proxyquire').noCallThru();
        const tracking = proxyquireStrict('./tracking', {
            'lib': () => {},
        });
    `)
  proxyquireTransformer(fileInfo, j, ast)
  expect(ast.toSource(getOptions())).toEqual(`
        jest.mock('lib', () => () => {});
        const tracking = require('./tracking');
    `)
  expect(mockedLogger).not.toHaveBeenCalled()
})

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
    `)
  proxyquireTransformer(fileInfo, j, ast)
  expect(ast.toSource(getOptions())).toEqual(`
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
    `)
  expect(mockedLogger).not.toHaveBeenCalled()
})

it('supports empty noCallThru', () => {
  const ast = j(`
        import proxyquire from 'proxyquire';
        proxyquire.noCallThru();
        const a = proxyquire('a', {'b': 'c'});
    `)
  proxyquireTransformer(fileInfo, j, ast)
  expect(ast.toSource(getOptions())).toEqual(`
        jest.mock('b', () => 'c');
        const a = require('a');
    `)
  expect(mockedLogger).not.toHaveBeenCalled()
})

it('supports the `load` method', () => {
  const ast = j(`
        import proxyquire from 'proxyquire';
        const a = proxyquire.load('a', {'b': 'c'});
    `)
  proxyquireTransformer(fileInfo, j, ast)
  expect(ast.toSource(getOptions())).toEqual(`
        jest.mock('b', () => 'c');
        const a = require('a');
    `)
  expect(mockedLogger).not.toHaveBeenCalled()
})

it('supports a chained `noCallThru().load()` call', () => {
  const ast = j(`
        import proxyquire from 'proxyquire';
        const a = proxyquire.noCallThru().load('a', {'b': 'c'});
    `)
  proxyquireTransformer(fileInfo, j, ast)
  expect(ast.toSource(getOptions())).toEqual(`
        jest.mock('b', () => 'c');
        const a = require('a');
    `)
  expect(mockedLogger).not.toHaveBeenCalled()
})

it('supports named imports scoped to the variable name', () => {
  const ast = j(`
        import pq from 'proxyquire';
        beforeEach( function(){
            const something = pq( 'a', {'b': 'c'});
        });
    `)
  proxyquireTransformer(fileInfo, j, ast)
  expect(ast.toSource(getOptions())).toEqual(`
        jest.mock('b', () => 'c');
        beforeEach( function(){
            const something = require('a');
        });
    `)
  expect(mockedLogger).not.toHaveBeenCalled()
})

it('logs error when proxyquire mocks are not defined in the file', () => {
  // TODO: this is kind of a bad state, but also a funny usage of proxyquire
  const ast = j(`
        import proxyquire from 'proxyquire';
        import mockedDeps from './someFile';
        proxyquire.noCallThru()('./index', mockedDeps);
    `)
  proxyquireTransformer(fileInfo, j, ast)
  expect(ast.toSource(getOptions())).toEqual(`
        import mockedDeps from './someFile';
        proxyquire.noCallThru()('./index', mockedDeps);
    `)
  expect(mockedLogger).toHaveBeenCalled()
})

it('logs error when type of mock is not known', () => {
  const ast = j(`
        import proxyquire from 'proxyquire';
        proxyquire.noCallThru()('./index', () => {});
    `)
  proxyquireTransformer(fileInfo, j, ast)
  expect(mockedLogger).toHaveBeenCalled()
})

it('logs error with multiple proxyquire to same file', () => {
  const ast = j(`
        import proxyquire from 'proxyquire';
        const routeHandler = proxyquire.noCallThru()('./handler', {
            '../page': mockedRender,
        });
        const failingRouteHandler = proxyquire.noCallThru()('./handler', {
            '../page': mockedFailingRender,
        });
    `)
  proxyquireTransformer(fileInfo, j, ast)
  expect(ast.toSource(getOptions())).toEqual(`
        jest.mock('../page', () => mockedRender);
        const routeHandler = require('./handler');
        const failingRouteHandler = proxyquire.noCallThru()('./handler', {
            '../page': mockedFailingRender,
        });
    `)
  expect(mockedLogger).toHaveBeenCalled()
})
