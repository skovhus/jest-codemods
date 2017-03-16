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

function testChanged(msg, source, expectedOutput) {
    test(msg, () => {
        const result = wrappedPlugin(source);
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
});
`,
`
test(() => {
  expect(stuff).toContain(1);
  expect(stuff).not.toContain('world');
  expect(stuff).not.toContain({b: 2});
  expect(stuff).not.toContain('world');
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

// FIXME: https://github.com/mjackson/expect#spies
