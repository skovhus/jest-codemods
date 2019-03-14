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
    jasmine.createSpy();
    jasmine.createSpy('lmao');
    `,
    `
    jest.spyOn().mockReturnValue();
    jest.spyOn(stuff);
    jest.spyOn(stuff).mockImplementation(() => 'lol');
    jest.spyOn(stuff).mockReturnValue('lmao');
    jest.spyOn();
    jest.spyOn(stuff).mockImplementation(() => {});
    jest.spyOn().mockImplementation();
    jest.fn();
    jest.fn();
    `
);

testChanged(
    'mock.calls.count()',
    `
    someMock.calls.count();
    stuff.someMock.calls.count();
    getMock(stuff).calls.count();
    getMock(stuff).calls.count() > 1;
    wyoming.cheyenne.callCount
    wyoming.cheyenne.stuff.mostRecentCall.args[0]
    georgia.atlanta.mostRecentCall.args.map(fn)
    args.map()
    oklahoma.argsForCall[0]
    idaho.argsForCall[0][1]
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
    wyoming.cheyenne.stuff.mock.calls[wyoming.cheyenne.stuff.mock.calls.length - 1][0]
    georgia.atlanta.mock.calls[georgia.atlanta.mock.calls.length - 1].map(fn)
    args.map()
    oklahoma.mock.calls[0]
    idaho.mock.calls[0][1]
    jest.spyOn('stuff').mockImplementation(fn);
    hmm.mockImplementation(fn);
    jest.spyOn('stuff').mockReturnValue('lol');
    jest.spyOn('stuff');
    stuff;
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
