/* eslint-env jest */
import { describe, test } from '@jest/globals'
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

describe('jasmine matchers', () => {
  test('toBeTrue', () =>
    expectTransformation('expect(stuff).toBeTrue()', 'expect(stuff).toBe(true)'))

  test('toBeFalse', () =>
    expectTransformation('expect(stuff).toBeFalse()', 'expect(stuff).toBe(false)'))

  test('toBePositiveInfinity', () =>
    expectTransformation(
      'expect(foo).toBePositiveInfinity()',
      'expect(foo).toBe(Infinity)'
    ))

  test('toBeNegativeInfinity', () =>
    expectTransformation(
      'expect(foo).toBeNegativeInfinity()',
      'expect(foo).toBe(-Infinity)'
    ))

  test('toHaveSize', () =>
    expectTransformation(
      'expect([1, 2]).toHaveSize(2)',
      'expect([1, 2]).toHaveLength(2)'
    ))

  test('toHaveClass', () =>
    expectTransformation(
      `expect(element).toHaveClass('active')`,
      `expect(element.classList.contains('active')).toBe(true)`
    ))

  test('toHaveBeenCalledOnceWith', () =>
    expectTransformation(
      `expect(mySpy).toHaveBeenCalledOnceWith('foo', 'bar')`,
      `expect(mySpy.mock.calls).toEqual([['foo', 'bar']])`
    ))

  test('toHaveBeenCalledBefore', () =>
    expectTransformation(
      'expect(mySpy).toHaveBeenCalledBefore(myOtherSpy)',
      'expect(Math.min(...mySpy.mock.invocationOrder)).toBeLessThan(Math.min(...myOtherSpy.mock.invocationOrder))'
    ))

  test('toHaveSpyInteractions', () =>
    expectTransformation(
      'expect(mySpyObj).toHaveSpyInteractions()',
      'expect(Object.values(mySpyObj).some(spy => spy.mock?.calls?.length)).toBe(true)'
    ))
})

test('spyOn', () => {
  expectTransformation(
    `
    jest.spyOn().mockReturnValue();
    spyOn(stuff).and.callThrough();
    spyOn(stuff).and.callFake(() => 'lol');
    existingSpy.and.callFake(() => 'lol');
    spyOn(stuff).and.returnValue('lmao');
    spyOn(stuff).and.returnValues(1,2,3);
    existingSpy.and.returnValue('lmao');
    jest.spyOn();
    spyOn(stuff);
    jest.spyOn().mockImplementation();
    jest.spyOn(stuff).and.resolveTo('lmao');
    jest.spyOn(stuff).and.rejectWith('oh no');
    const fetchSpy = spyOn(window, 'fetch').and.resolveTo({json: {}});
    existingSpy.and.callThrough();
    `,
    `
    jest.spyOn().mockReturnValue();
    jest.spyOn(stuff);
    jest.spyOn(stuff).mockImplementation(() => 'lol');
    existingSpy.mockImplementation(() => 'lol');
    jest.spyOn(stuff).mockReturnValue('lmao');
    jest.spyOn(stuff).mockReturnValue(1).mockReturnValue(2).mockReturnValue(3);
    existingSpy.mockReturnValue('lmao');
    jest.spyOn();
    jest.spyOn(stuff).mockImplementation(() => {});
    jest.spyOn().mockImplementation();
    jest.spyOn(stuff).mockResolvedValue('lmao');
    jest.spyOn(stuff).mockRejectedValue('oh no');
    const fetchSpy = jest.spyOn(window, 'fetch').mockResolvedValue({json: {}});
    existingSpy.mockRestore();
    `
  )
})

test('spyOnProperty', () => {
  expectTransformation(
    `
    spyOnProperty(component, 'propertyName1').and.returnValue(42);
    spyOnProperty(component, 'propertyName2', 'get').and.returnValue(true);
    jest.spyOn(something, 'property', 'get');`,
    `
    jest.spyOn(component, 'propertyName1', 'get').mockReturnValue(42);
    jest.spyOn(component, 'propertyName2', 'get').mockReturnValue(true);
    jest.spyOn(something, 'property', 'get');`
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
    jasmine.createSpy().and.resolveTo('lmao');
    jasmine.createSpy().and.rejectWith('oh no');
    const spy3 = jasmine.createSpy().and.resolveTo('lmao');
    spy.and.throwError('my error message');
    spy.and.throwError(new Error('awesome error'));
    spy.and.throwError(42);
    `,
    `
    jest.fn();
    jest.fn();
    const spy1 = jest.fn();
    jest.fn(arg => arg);
    jest.fn(() => 'lmao');
    const spy2 = jest.fn(() => 'lmao');
    jest.fn().mockResolvedValue('lmao');
    jest.fn().mockRejectedValue('oh no');
    const spy3 = jest.fn().mockResolvedValue('lmao');
    spy.mockImplementation(() => {
        throw new Error('my error message');
    });
    spy.mockImplementation(() => {
        throw new Error('awesome error');
    });
    spy.mockImplementation(() => {
        throw 42;
    });
    `
  )

  // Ensure we haven't missed any console warnings
  expect(consoleWarnings).toEqual([])
})

test('jasmine.createSpy with generic types', () => {
  expectTransformation(
    `
    import type log from './log';
    
    jasmine.createSpy<typeof log>();
    jasmine.createSpy<() => void>();
    `,
    `
    import type log from './log';
    
    jest.fn<typeof log>();
    jest.fn<() => void>();
    `,
    { parser: 'ts' }
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

test('*.calls.reset()', () => {
  expectTransformation(
    `
    someMock.calls.reset();
    stuff.someMock.calls.reset();
    getMock(stuff).calls.reset();
    `,
    `
    someMock.mockReset();
    stuff.someMock.mockReset();
    getMock(stuff).mockReset();
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

test('*.calls.allArgs()', () => {
  expectTransformation(
    `
    const args = someSpy.calls.allArgs();
    anotherSpy.calls.allArgs()[0];

    foo.allArgs();
    `,
    `
    const args = someSpy.mock.calls;
    anotherSpy.mock.calls[0];

    foo.allArgs();
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

test.each(['babel', 'flow', 'ts'])('*.calls.argsFor() with parser `%s`', (parser) => {
  expectTransformation(
    `
    oklahoma.calls.argsFor(0)
    idaho.calls.argsFor(0)[1]
    mySpy.calls.argsFor(myCounter)[0]
    `,
    `
    oklahoma.mock.calls[0]
    idaho.mock.calls[0][1]
    mySpy.mock.calls[myCounter][0]
    `,
    {
      parser,
    }
  )
})

test('jasmine.clock()', () => {
  expectTransformation(
    `
    jasmine.clock().install();
    jasmine.clock().uninstall();
    jasmine.clock().tick(50);
    jasmine.clock().mockDate(new Date(2013, 9, 23));
    `,
    `
    jest.useFakeTimers();
    jest.useRealTimers();
    jest.advanceTimersByTime(50);
    jest.setSystemTime(new Date(2013, 9, 23));
    `
  )
})

test('not supported jasmine.clock()', () => {
  wrappedPlugin(`
        jasmine.clock().unknownUtil();
    `)

  expect(consoleWarnings).toEqual([
    'jest-codemods warning: (test.js line 2) Unsupported Jasmine functionality "jasmine.clock().unknownUtil".',
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

describe('createSpyObj', () => {
  test('with methodNames array and no properties', () => {
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

  test('with methodNames array and properties object', () => {
    expectTransformation(
      `
    const spyObj = jasmine.createSpyObj('', ['a', 'b'], { c: 5 });
    `,
      `
    const spyObj = {
        'a': jest.fn(),
        'b': jest.fn(),
        'c': 5
    };
    `
    )
  })

  test('with methods object and no properties', () => {
    expectTransformation(
      `
    const spyObj = jasmine.createSpyObj('label', {
        a: 42,
        b: true,
        c: of(undefined)
    });
    `,
      `
    const spyObj = {
        'a': jest.fn(() => 42),
        'b': jest.fn(() => true),
        'c': jest.fn(() => of(undefined))
    };
    `
    )
  })

  test('with methods object and properties array', () => {
    expectTransformation(
      `
    const spyObj = jasmine.createSpyObj('label', {
        a: 42,
        b: true
    }, ['c']);
    `,
      `
    const spyObj = {
        'a': jest.fn(() => 42),
        'b': jest.fn(() => true),
        'c': null
    };
    `
    )
  })

  test('without base name and methods names only', () => {
    expectTransformation(
      `
    const spyObj = jasmine.createSpyObj(['someMethod']);
    `,
      `
    const spyObj = {
        'someMethod': jest.fn()
    };
    `
    )
  })

  test('without base name and methods names as well as properties object', () => {
    expectTransformation(
      `
    const spyObj = jasmine.createSpyObj(['someMethod'], {property: true});
    `,
      `
    const spyObj = {
        'someMethod': jest.fn(),
        'property': true
    };
    `
    )
  })

  test('with types', () => {
    expectTransformation(
      `
    import { LoggerService } from './logger-service.ts';

    const loggerSpy = jasmine.createSpyObj<LoggerService>('LoggerService', ['log']);
    `,
      `
    import { LoggerService } from './logger-service.ts';

    const loggerSpy: jest.Mocked<LoggerService> = {
        'log': jest.fn()
    };
    `,
      { parser: 'ts' }
    )
  })

  test('with methods object that contain nested jasmine Spies', () => {
    expectTransformation(
      `
    const spyObj = jasmine.createSpyObj({
        a: jasmine.createSpy(),
        b: jasmine.createSpy().and.returnValue(true),
        c: of(42)
    });
    `,
      `
    const spyObj = {
        'a': jest.fn(),
        'b': jest.fn(() => true),
        'c': jest.fn(() => of(42))
    };
    `
    )
  })
})

describe('types', () => {
  test('jasmine.SpyObj', () =>
    expectTransformation(
      `
      let loggerSpy: jasmine.SpyObj<LoggerService>;
      let unknownSpy: jasmine.SpyObj<unknown>;
      const errorHandlerSpy: jasmine.SpyObj<ErrorHandler> = jasmine.createSpyObj('ErrorHandler', ['handleError']);
      let translateSpy: jasmine.SpyObj<TranslateService>;
      translateSpy = jasmine.createSpyObj<TranslateService>(['translate']);
      `,
      `
      let loggerSpy: jest.Mocked<LoggerService>;
      let unknownSpy: jest.Mocked<unknown>;
      const errorHandlerSpy: jest.Mocked<ErrorHandler> = {
            'handleError': jest.fn()
      };
      let translateSpy: jest.Mocked<TranslateService>;
      translateSpy = {
            'translate': jest.fn()
      };
      `,
      { parser: 'ts' }
    ))

  test('jasmine.Spy', () =>
    expectTransformation(
      `
        let setLanguageSpy: jasmine.Spy;
        let logSpy: jasmine.Spy<(message: string) => void>;
        const handleErrorSpy: jasmine.Spy<ErrorHandler['handleError']> = jasmine.createSpy();
        let translateMock: { translate: jasmine.Spy };
        class Foo { something: jasmine.Spy<(value: string) => void>; }
        type MySpy = jasmine.Spy<(value: string) => void>;
        `,
      `
        let setLanguageSpy: jest.Mock;
        let logSpy: jest.Mock<(message: string) => void>;
        const handleErrorSpy: jest.Mock<ErrorHandler['handleError']> = jest.fn();
        let translateMock: { translate: jest.Mock };
        class Foo { something: jest.Mock<(value: string) => void>; }
        type MySpy = jest.Mock<(value: string) => void>;
        `,
      { parser: 'ts' }
    ))
})

test('arrayWithExactContents', () => {
  expectTransformation(
    `
    expect(array1).toEqual(jasmine.arrayWithExactContents(array2));
    expect([3,1,2]).toStrictEqual(jasmine.arrayWithExactContents([1,2,3]));
    `,
    `
    expect(array1.sort()).toEqual(array2.sort());
    expect([3,1,2].sort()).toStrictEqual([1,2,3].sort());
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

function expectTransformation(source, expectedOutput, options = {}) {
  const result = wrappedPlugin(source, options)
  expect(result).toBe(expectedOutput)
}
