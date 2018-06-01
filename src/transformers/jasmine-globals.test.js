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
    `,
    `
    someMock.mock.calls.length;
    stuff.someMock.mock.calls.length;
    getMock(stuff).mock.calls.length;
    getMock(stuff).mock.calls.length > 1;
    `
);
