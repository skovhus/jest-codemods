/* eslint-env jest */
import chalk from 'chalk'

import { wrapPlugin } from '../utils/test-helpers'
import plugin from './jasmine-globals'

chalk.level = 0
const wrappedPlugin = wrapPlugin(plugin)

function testChanged(msg, source, expectedOutput) {
  test(msg, () => {
    const result = wrappedPlugin(source)
    expect(result).toBe(expectedOutput)
  })
}

let consoleWarnings = []
beforeEach(() => {
  consoleWarnings = []
  console.warn = (v) => consoleWarnings.push(v)
})

testChanged(
  'spyOn',
  `
    jest.spyOn().mockReturnValue();
    spyOn(stuff).and.callThrough();
    spyOn(stuff).and.callFake(() => 'lol');
    spyOn(stuff).and.returnValue('lmao');
    jest.spyOn();
    spyOn(stuff);
    jest.spyOn().mockImplementation();
    `,
  `
    jest.spyOn().mockReturnValue();
    jest.spyOn(stuff);
    jest.spyOn(stuff).mockImplementation(() => 'lol');
    jest.spyOn(stuff).mockReturnValue('lmao');
    jest.spyOn();
    jest.spyOn(stuff).mockImplementation(() => {});
    jest.spyOn().mockImplementation();
    `
)

testChanged(
  'jasmine.createSpy',
  `
    jasmine.createSpy();
    jasmine.createSpy('lmao');
    const spy = jasmine.createSpy();
    jasmine.createSpy().and.callFake(arg => arg);
    jasmine.createSpy().and.returnValue('lmao');
    const spy = jasmine.createSpy().and.returnValue('lmao');
    `,
  `
    jest.fn();
    jest.fn();
    const spy = jest.fn();
    jest.fn(arg => arg);
    jest.fn(() => 'lmao');
    const spy = jest.fn(() => 'lmao');
    `
)

test('not supported jasmine.createSpy().and.*', () => {
  wrappedPlugin(`
        jasmine.createSpy().and.unknownUtil();
    `)

  expect(consoleWarnings).toEqual([
    'jest-codemods warning: (test.js line 2) Unsupported Jasmine functionality "jasmine.createSpy().and.unknownUtil".',
  ])
})

testChanged(
  '*.calls.count()',
  `
    someMock.calls.count();
    stuff.someMock.calls.count();
    getMock(stuff).calls.count();
    getMock(stuff).calls.count() > 1;
    wyoming.cheyenne.callCount
    args.map()
    spyOn('stuff').andCallFake(fn);
    hmm.andCallFake(fn);
    spyOn('stuff').andReturn('lol');
    spyOn('stuff').andCallThrough();
    stuff.andCallThrough();
    `,
  `
    someMock.mock.calls.length;
    stuff.someMock.mock.calls.length;
    getMock(stuff).mock.calls.length;
    getMock(stuff).mock.calls.length > 1;
    wyoming.cheyenne.mock.calls.length
    args.map()
    jest.spyOn('stuff').mockImplementation(fn);
    hmm.mockImplementation(fn);
    jest.spyOn('stuff').mockReturnValue('lol');
    jest.spyOn('stuff');
    stuff;
    `
)

testChanged(
  '*.mostRecentCall',
  `
    wyoming.cheyenne.stuff.mostRecentCall.args[0]
    georgia.atlanta.mostRecentCall.args.map(fn)
    `,
  `
    wyoming.cheyenne.stuff.mock.calls[wyoming.cheyenne.stuff.mock.calls.length - 1][0]
    georgia.atlanta.mock.calls[georgia.atlanta.mock.calls.length - 1].map(fn)
    `
)

testChanged(
  '*.calls.mostRecent()',
  `
    const foo = someMock.calls.mostRecent();
    someMock.calls.mostRecent()[0];

    foo.mostRecent();
    `,
  `
    const foo = someMock.mock.calls[someMock.mock.calls.length - 1];
    someMock.mock.calls[someMock.mock.calls.length - 1][0];

    foo.mostRecent();
    `
)

testChanged(
  '*.argsForCall',
  `
    oklahoma.argsForCall[0]
    idaho.argsForCall[0][1]
    `,
  `
    oklahoma.mock.calls[0]
    idaho.mock.calls[0][1]
    `
)

testChanged(
  '*.calls.argsFor()',
  `
    oklahoma.calls.argsFor(0)
    idaho.calls.argsFor(0)[1]
    `,
  `
    oklahoma.mock.calls[0]
    idaho.mock.calls[0][1]
    `
)

testChanged(
  'jasmine.clock()',
  `
    jasmine.clock().install();
    jasmine.clock().uninstall();
    jasmine.clock().tick(50);
    `,
  `
    jest.useFakeTimers();
    jest.useRealTimers();
    jest.advanceTimersByTime(50);
    `
)

test('not supported jasmine.clock()', () => {
  wrappedPlugin(`
        jasmine.clock().mockDate(new Date(2013, 9, 23));
        jasmine.clock().unknownUtil();
    `)

  expect(consoleWarnings).toEqual([
    'jest-codemods warning: (test.js line 2) Unsupported Jasmine functionality "jasmine.clock().mockDate(*)".',
    'jest-codemods warning: (test.js line 3) Unsupported Jasmine functionality "jasmine.clock().unknownUtil".',
  ])
})

testChanged(
  'jasmine.<jasmineToExpectFunctionName>(*)',
  `
    jasmine.any(Function);
    jasmine.anything();
    jasmine.arrayContaining(['foo']);
    jasmine.objectContaining({ foo: 'bar' });
    jasmine.stringMatching('text');
    `,
  `
    expect.any(Function);
    expect.anything();
    expect.arrayContaining(['foo']);
    expect.objectContaining({ foo: 'bar' });
    expect.stringMatching('text');
    `
)

testChanged(
  'createSpyObj',
  `
    const spyObj = jasmine.createSpyObj('label', ['a', 'b', 'hyphen-ated']);
    `,
  `
    const spyObj = {
        'a': jest.fn(),
        'b': jest.fn(),
        'hyphen-ated': jest.fn()
    };
    `
)

testChanged(
  'return value',
  `
    focusMonitorMock = jasmine.createSpyObj('FocusMonitorMock', ['monitor', 'stopMonitoring']);
    focusMonitorMock.monitor.and.returnValue(of());
    `,
    `
    focusMonitorMock = {
        'monitor': jest.fn(() => of()),
        'stopMonitoring': jest.fn()
    };
    `
)
