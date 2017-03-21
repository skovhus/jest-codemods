/* eslint-env jest */
import chalk from 'chalk';
import { wrapPlugin } from '../utils/test-helpers';
import plugin from './expect';

chalk.enabled = false;
const wrappedPlugin = wrapPlugin(plugin);

let consoleWarnings = [];
beforeEach(() => {
    consoleWarnings = [];
    console.warn = v => consoleWarnings.push(v);
});

function testChanged(msg, source, expectedOutput, options = {}) {
    test(msg, () => {
        const result = wrappedPlugin(source, options);
        expect(result).toBe(expectedOutput);
        expect(consoleWarnings).toEqual([]);
    });
}

testChanged('does not touch code without expect require/import',
`
const test = require("testlib");
test(t => {
  expect(stuff).toExist();
})
`,
`
const test = require("testlib");
test(t => {
  expect(stuff).toExist();
})
`
);

testChanged('maps expect matchers',
`
import expect from 'expect';

test(() => {
  expect(stuff).toExist();
  expect(stuff).toExist('message');
  expect(stuff).toBeTruthy();
  expect(stuff).toBeTruthy('message');

  expect(stuff).toNotExist();
  expect(stuff).toNotExist('message');
  expect(stuff).toBeFalsy();
  expect(stuff).toBeFalsy('message');

  expect(stuff).toBe(null);
  expect(stuff).toBe(null, 'message');

  expect(stuff).toNotBe(42);
  expect(stuff).toNotBe(42, 'message');

  expect(stuff).toNotEqual({}, 'message');
  expect(stuff).toNotEqual(42);

  expect(stuff).toThrow();
  expect(stuff).toThrow(/bum/);
  expect(stuff).toThrow(/bum/, 'yes sir');

  expect(stuff).toNotThrow();
  expect(stuff).toNotThrow(/bum/);
  expect(stuff).toNotThrow(/bum/, 'yes sir');

  expect(stuff).toBeA('number');
  expect(stuff).toBeA('number', 'message');

  expect(stuff).toBeAn(Array);
  expect(new Stuff).toBeAn(Stuff, 'Message');

  expect(stuff).toNotBeA(Number);
  expect(stuff).toNotBeAn(Array);

  expect(stuff).toMatch({foo: 'bar'});
  expect(stuff).toMatch({foo: 'bar'}, 'message');
  expect(stuff).toMatch('a string');
  expect(stuff).toMatch('a string', 'message');

  expect(stuff).toNotMatch({foo: 'bar'});
  expect(stuff).toNotMatch({foo: 'bar'}, 'message');
  expect(stuff).toNotMatch('a string');
  expect(stuff).toNotMatch('a string', 'message');

  expect(stuff).toHaveBeenCalled();
  expect(stuff).toNotHaveBeenCalled();
  expect(stuff).toHaveBeenCalledWith();
});
`,
`
test(() => {
  expect(stuff).toBeTruthy();
  expect(stuff).toBeTruthy();
  expect(stuff).toBeTruthy();
  expect(stuff).toBeTruthy();

  expect(stuff).toBeFalsy();
  expect(stuff).toBeFalsy();
  expect(stuff).toBeFalsy();
  expect(stuff).toBeFalsy();

  expect(stuff).toBe(null);
  expect(stuff).toBe(null);

  expect(stuff).not.toBe(42);
  expect(stuff).not.toBe(42);

  expect(stuff).not.toEqual({});
  expect(stuff).not.toEqual(42);

  expect(stuff).toThrow();
  expect(stuff).toThrow(/bum/);
  expect(stuff).toThrow(/bum/);

  expect(stuff).not.toThrow();
  expect(stuff).not.toThrow(/bum/);
  expect(stuff).not.toThrow(/bum/);

  expect(typeof stuff).toBe('number');
  expect(typeof stuff).toBe('number');

  expect(stuff).toBeInstanceOf(Array);
  expect(new Stuff).toBeInstanceOf(Stuff);

  expect(stuff).not.toBeInstanceOf(Number);
  expect(stuff).not.toBeInstanceOf(Array);

  expect(stuff).toMatchObject({foo: 'bar'});
  expect(stuff).toMatchObject({foo: 'bar'});
  expect(stuff).toMatch('a string');
  expect(stuff).toMatch('a string');

  expect(stuff).not.toMatchObject({foo: 'bar'});
  expect(stuff).not.toMatchObject({foo: 'bar'});
  expect(stuff).not.toMatch('a string');
  expect(stuff).not.toMatch('a string');

  expect(stuff).toHaveBeenCalled();
  expect(stuff).not.toHaveBeenCalled();
  expect(stuff).toHaveBeenCalledWith();
});
`);

testChanged('maps expect number matchers',
`
import expect from 'expect';

test(() => {
  expect(stuff).toBeLessThan(42);
  expect(stuff).toBeFewerThan(42);
  expect(stuff).toBeLessThanOrEqualTo(42);
  expect(stuff).toBeMoreThan(42);
  expect(stuff).toBeGreaterThanOrEqualTo(42);
});
`,
`
test(() => {
  expect(stuff).toBeLessThan(42);
  expect(stuff).toBeLessThan(42);
  expect(stuff).toBeLessThanOrEqual(42);
  expect(stuff).toBeGreaterThan(42);
  expect(stuff).toBeGreaterThanOrEqual(42);
});
`);

testChanged('maps expect contain matchers',
`
import expect from 'expect';

test(() => {
  expect(stuff).toInclude(1);
  expect(stuff).toExclude('world');
  expect(stuff).toNotContain({b: 2});
  expect(stuff).toNotInclude('world');

  expect({ a: 1 }).toIncludeKey('a');
  expect({ a: 1 }).toExcludeKey('b');

  expect({ a: 1, b: 2 }).toIncludeKeys([ 'a', 'b' ]);
  expect({ a: 1, b: 2 }).toExcludeKeys([ 'c', 'd' ]);
});
`,
`
test(() => {
  expect(stuff).toContain(1);
  expect(stuff).not.toContain('world');
  expect(stuff).not.toContain({b: 2});
  expect(stuff).not.toContain('world');

  expect(Object.keys({ a: 1 })).toContain('a');
  expect(Object.keys({ a: 1 })).not.toContain('b');

  [ 'a', 'b' ].forEach(e => {
    expect({ a: 1, b: 2 }).toContain(e);
  });
  [ 'c', 'd' ].forEach(e => {
    expect({ a: 1, b: 2 }).not.toContain(e);
  });
});
`);

testChanged('maps expect spy matchers',
`
import expect from 'expect';

test(() => {
  expect(stuff).toHaveBeenCalled();
  expect(stuff).toNotHaveBeenCalled();
  expect(stuff).toHaveBeenCalledWith();
});
`,
`
test(() => {
  expect(stuff).toHaveBeenCalled();
  expect(stuff).not.toHaveBeenCalled();
  expect(stuff).toHaveBeenCalledWith();
});
`);

testChanged('maps spy calls',
`
import expect from 'expect';

test(() => {
  var spy1 = expect.createSpy();
  var spy2 = expect.spyOn(video, 'play');
  expect.spyOn(video, 'play');
  spy1.restore();
  spy1.reset();
});
`,
`
test(() => {
  var spy1 = expect.createSpy();
  var spy2 = jest.spyOn(video, 'play');
  jest.spyOn(video, 'play');
  spy1.restore();
  spy1.reset();
});
`);

testChanged('renames non standard expect import name',
`
import exp from 'expect';

test(() => {
  exp(stuff).toHaveBeenCalled();
  exp(stuff).toNotHaveBeenCalled();
  exp(stuff).toHaveBeenCalledWith();
});
`,
`
test(() => {
  expect(stuff).toHaveBeenCalled();
  expect(stuff).not.toHaveBeenCalled();
  expect(stuff).toHaveBeenCalledWith();
});
`);

testChanged('standaloneMode: keeps expect import',
`
import exp from 'expect';

test(() => {
  exp(stuff).toHaveBeenCalled();
});
`,
`
import exp from 'expect';

test(() => {
  exp(stuff).toHaveBeenCalled();
});
`, {
    standaloneMode: true,
});

testChanged('standaloneMode: rewrites expect.spyOn (import)',
`
// @flow
import expect from 'expect';

test(() => {
    var spy1 = expect.createSpy();
    var spy2 = expect.spyOn(video, 'play');
    expect.spyOn(video, 'play');

    expect.restoreSpies();
    expect.isSpy(spy1);

    spy1.restore();
    spy1.reset();
    expect(spy1.calls.length).toEqual(3);
});
`,
`
// @flow
import expect from 'expect';

import mock from 'jest-mock';

test(() => {
    var spy1 = expect.createSpy();
    var spy2 = mock.spyOn(video, 'play');
    mock.spyOn(video, 'play');

    expect.restoreSpies();
    expect.isSpy(spy1);

    spy1.restore();
    spy1.reset();
    expect(spy1.calls.length).toEqual(3);
});
`, {
    standaloneMode: true,
});

testChanged('standaloneMode: rewrites expect.spyOn (require)',
`
// @flow
const expect = require('expect');

test(() => {
    var spy1 = expect.createSpy();
    var spy2 = expect.spyOn(video, 'play');
});
`,
`
// @flow
const expect = require('expect');

const mock = require('jest-mock')

test(() => {
    var spy1 = expect.createSpy();
    var spy2 = mock.spyOn(video, 'play');
});
`, {
    standaloneMode: true,
});

test('warns about chaining', () => {
    wrappedPlugin(`
        import expect from 'expect';

        test(() => {
          expect(3.14)
            .toExist()
            .toBeLessThan(4)
            .toBeGreaterThan(3);
        });
    `);
    expect(JSON.stringify(consoleWarnings)).toEqual(JSON.stringify([
        'jest-codemods warning: (test.js line 5) Chaining except matchers is currently not supported',
    ]));
});
