/* eslint-env jest */
import { wrapPlugin } from '../utils/test-helpers';
import plugin from './expect';

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

test(t => {
  expect(stuff).toExist();
  expect(stuff).toNotExist();
  expect(stuff).toNotBe();
  expect(stuff).toNotEqual();
  expect(stuff).toNotThrow();
  expect(stuff).toBeA(number);
  expect(stuff).toBeAn(Array);
  expect(stuff).toMatch({foo: 'bar'});
  expect(stuff).toMatch('a string');
  expect(stuff).toNotBeA(number);
  expect(stuff).toNotBeAn(Array);
  expect(stuff).toNotMatch({foo: 'bar'});
  expect(stuff).toNotMatch('a string');
  expect(stuff).toBeFewerThan(42);
  expect(stuff).toBeLessThanOrEqualTo(42);
  expect(stuff).toBeMoreThan(42);
  expect(stuff).toBeGreaterThanOrEqualTo(42);
  expect(stuff).toInclude(1);
  expect(stuff).toExclude('world');
  expect(stuff).toNotContain({b: 2});
  expect(stuff).toNotInclude('world');
  expect(stuff).toNotHaveBeenCalled();
});
`,
`
test(t => {
  expect(stuff).toBeTruthy();
  expect(stuff).toBeFalsy();
  expect(stuff).not.toBe();
  expect(stuff).not.toEqual();
  expect(stuff).not.toThrow();
  expect(stuff).toBeInstanceOf(number);
  expect(stuff).toBeInstanceOf(Array);
  expect(stuff).toMatchObject({foo: 'bar'});
  expect(stuff).toMatch('a string');
  expect(stuff).not.toBeInstanceOf(number);
  expect(stuff).not.toBeInstanceOf(Array);
  expect(stuff).not.toMatchObject({foo: 'bar'});
  expect(stuff).not.toMatch('a string');
  expect(stuff).toBeLessThan(42);
  expect(stuff).toBeLessThanOrEqual(42);
  expect(stuff).toBeGreaterThan(42);
  expect(stuff).toBeGreaterThanOrEqual(42);
  expect(stuff).toContain(1);
  expect(stuff).not.toContain('world');
  expect(stuff).not.toContain({b: 2});
  expect(stuff).not.toContain('world');
  expect(stuff).not.toHaveBeenCalled();
});
`);
