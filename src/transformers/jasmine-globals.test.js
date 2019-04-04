/* eslint-env jest */
import chalk from 'chalk';
import { wrapPlugin } from '../utils/test-helpers';
import plugin from './jasmine-globals';

chalk.enabled = false;
const wrappedPlugin = wrapPlugin(plugin);

function testChanged(msg, source, expectedOutput) {
    test(msg, () => {
        const result = wrappedPlugin(source);
        expect(result).toBe(expectedOutput);
    });
}

let consoleWarnings = [];
beforeEach(() => {
    consoleWarnings = [];
    console.warn = v => consoleWarnings.push(v);
});

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
);

testChanged(
    'jasmine.createSpy with later .and usage',
    `
    let bar;

    it('does a thing', () => {
        const foo = jasmine.createSpy();
        bar = jasmine.createSpy();
        const baz = jasmine.createSpy().and.returnValue('baz');

        foo.and.returnValue('lmao');
        foo.and.callFake(arg => arg);

        bar.and.returnValue('lmao');
        bar.and.callFake(arg => arg);

        baz.and.returnValue('lmao');
        baz.and.callFake(arg => arg);
    });

    bar.and.returnValue('lmao');
    bar.and.callFake(arg => arg);

    it('does a different thing', () => {
        const foo = 'some value';
        bar = 'another value';

        // unchanged
        foo.and.returnValue('lmao');
        foo.and.callFake(arg => arg);
        baz.and.returnValue('lmao');
        baz.and.callFake(arg => arg);

        // changed within scope of being a spy
        bar.and.returnValue('lmao');
        bar.and.callFake(arg => arg);
    });
    `,
    `
    let bar;

    it('does a thing', () => {
        const foo = jest.fn();
        bar = jest.fn();
        const baz = jest.fn(() => 'baz');

        foo.mockReturnValue('lmao');
        foo.mockImplementation(arg => arg);

        bar.mockReturnValue('lmao');
        bar.mockImplementation(arg => arg);

        baz.mockReturnValue('lmao');
        baz.mockImplementation(arg => arg);
    });

    bar.mockReturnValue('lmao');
    bar.mockImplementation(arg => arg);

    it('does a different thing', () => {
        const foo = 'some value';
        bar = 'another value';

        // unchanged
        foo.and.returnValue('lmao');
        foo.and.callFake(arg => arg);
        baz.and.returnValue('lmao');
        baz.and.callFake(arg => arg);

        // changed within scope of being a spy
        bar.mockReturnValue('lmao');
        bar.mockImplementation(arg => arg);
    });
    `
);

test('not supported jasmine.createSpy().and.*', () => {
    wrappedPlugin(`
        jasmine.createSpy().and.unknownUtil();
    `);

    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 2) Unsupported Jasmine functionality "jasmine.createSpy().and.unknownUtil".',
    ]);
});

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
);

testChanged(
    'spyOn() with later .and usage',
    `
    let bar;

    it('does a thing', () => {
        const foo = spyOn(stuff);
        bar = spyOn(stuff);
        const baz = spyOn(stuff).and.returnValue('baz');

        foo.and.returnValue('lmao');
        foo.and.callFake(arg => arg);

        bar.and.returnValue('lmao');
        bar.and.callFake(arg => arg);

        baz.and.returnValue('lmao');
        baz.and.callFake(arg => arg);
    });

    bar.and.returnValue('lmao');
    bar.and.callFake(arg => arg);

    it('does a different thing', () => {
        const foo = 'some value';
        bar = 'another value';

        // unchanged
        foo.and.returnValue('lmao');
        foo.and.callFake(arg => arg);
        baz.and.returnValue('lmao');
        baz.and.callFake(arg => arg);

        // changed within scope of being a spy
        bar.and.returnValue('lmao');
        bar.and.callFake(arg => arg);
    });
    `,
    `
    let bar;

    it('does a thing', () => {
        const foo = jest.spyOn(stuff);
        bar = jest.spyOn(stuff);
        const baz = jest.spyOn(stuff).mockReturnValue('baz');

        foo.mockReturnValue('lmao');
        foo.mockImplementation(arg => arg);

        bar.mockReturnValue('lmao');
        bar.mockImplementation(arg => arg);

        baz.mockReturnValue('lmao');
        baz.mockImplementation(arg => arg);
    });

    bar.mockReturnValue('lmao');
    bar.mockImplementation(arg => arg);

    it('does a different thing', () => {
        const foo = 'some value';
        bar = 'another value';

        // unchanged
        foo.and.returnValue('lmao');
        foo.and.callFake(arg => arg);
        baz.and.returnValue('lmao');
        baz.and.callFake(arg => arg);

        // changed within scope of being a spy
        bar.mockReturnValue('lmao');
        bar.mockImplementation(arg => arg);
    });
    `
);

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
);

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
);

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
);

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
);

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
);

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
);

test('not supported jasmine.clock()', () => {
    wrappedPlugin(`
        jasmine.clock().mockDate(new Date(2013, 9, 23));
        jasmine.clock().unknownUtil();
    `);

    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 2) Unsupported Jasmine functionality "jasmine.clock().mockDate(*)".',
        'jest-codemods warning: (test.js line 3) Unsupported Jasmine functionality "jasmine.clock().unknownUtil".',
    ]);
});
