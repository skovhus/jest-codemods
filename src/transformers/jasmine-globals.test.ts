/* eslint-env jest */
import { jest } from '@jest/globals'
import chalk from 'chalk'

import { wrapPlugin } from '../utils/test-helpers'
import plugin from './jasmine-globals'

chalk.level = 0
const wrappedPlugin = wrapPlugin(plugin)
let consoleWarnings = []

beforeEach(() => {
  consoleWarnings = []
  jest.spyOn(console, 'warn').mockImplementation((v) => consoleWarnings.push(v))
})

test('spyOn', () => {
  expectTransformation(
    `
    jest.spyOn().mockReturnValue();
    spyOn(stuff).and.callThrough();
    spyOn(stuff).and.callFake(() => 'lol');
    existingSpy.and.callFake(() => 'lol');
    spyOn(stuff).and.returnValue('lmao');
    existingSpy.and.returnValue('lmao');
    jest.spyOn();
    spyOn(stuff);
    jest.spyOn().mockImplementation();
    `,
    `
    jest.spyOn().mockReturnValue();
    jest.spyOn(stuff);
    jest.spyOn(stuff).mockImplementation(() => 'lol');
    existingSpy.mockImplementation(() => 'lol');
    jest.spyOn(stuff).mockReturnValue('lmao');
    existingSpy.mockReturnValue('lmao');
    jest.spyOn();
    jest.spyOn(stuff).mockImplementation(() => {});
    jest.spyOn().mockImplementation();
    `
  )
})

test('jasmine.createSpy', () => {
  expectTransformation(
    `
    jasmine.createSpy();
    jasmine.createSpy('lmao');
    const spy1 = jasmine.createSpy();
    jasmine.createSpy().and.callFake(arg => arg);
    jasmine.createSpy().and.returnValue('lmao');
    const spy2 = jasmine.createSpy().and.returnValue('lmao');
    `,
    `
    jest.fn();
    jest.fn();
    const spy1 = jest.fn();
    jest.fn(arg => arg);
    jest.fn(() => 'lmao');
    const spy2 = jest.fn(() => 'lmao');
    `
  )
})

test('not supported jasmine.createSpy().and.*', () => {
  wrappedPlugin(`
        jasmine.createSpy().and.unknownUtil();
    `)

  expect(consoleWarnings).toEqual([
    'jest-codemods warning: (test.js line 2) Unsupported Jasmine functionality "jasmine.createSpy().and.unknownUtil".',
  ])
})

test('*.calls.count()', () => {
  expectTransformation(
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
})

test('*.mostRecentCall', () => {
  expectTransformation(
    `
    wyoming.cheyenne.stuff.mostRecentCall.args[0]
    georgia.atlanta.mostRecentCall.args.map(fn)
    `,
    `
    wyoming.cheyenne.stuff.mock.calls[wyoming.cheyenne.stuff.mock.calls.length - 1][0]
    georgia.atlanta.mock.calls[georgia.atlanta.mock.calls.length - 1].map(fn)
    `
  )
})

test('*.calls.mostRecent()', () => {
  expectTransformation(
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
})

test('*.argsForCall', () => {
  expectTransformation(
    `
    oklahoma.argsForCall[0]
    idaho.argsForCall[0][1]
    `,
    `
    oklahoma.mock.calls[0]
    idaho.mock.calls[0][1]
    `
  )
})

test('*.calls.argsFor()', () => {
  expectTransformation(
    `
    oklahoma.calls.argsFor(0)
    idaho.calls.argsFor(0)[1]
    `,
    `
    oklahoma.mock.calls[0]
    idaho.mock.calls[0][1]
    `
  )
})

test('jasmine.clock()', () => {
  expectTransformation(
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
})

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

test('jasmine.<jasmineToExpectFunctionName>(*)', () => {
  expectTransformation(
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
})

test('createSpyObj', () => {
  expectTransformation(
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
})

test('return value', () => {
  expectTransformation(
    `
    focusMonitorMock = jasmine.createSpyObj('FocusMonitorMock', ['monitor', 'stopMonitoring']);
    focusMonitorMock.monitor.and.returnValue(of());
    `,
    `
    focusMonitorMock = {
        'monitor': jest.fn(),
        'stopMonitoring': jest.fn()
    };
    focusMonitorMock.monitor.mockReturnValue(of());
    `
  )
})

function expectTransformation(source, expectedOutput) {
  const result = wrappedPlugin(source)
  expect(result).toBe(expectedOutput)
}
