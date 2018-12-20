/* eslint-env jest */
import chalk from 'chalk';
import { wrapPlugin } from '../utils/test-helpers';
import plugin from './chai-assert';

chalk.enabled = false;

const wrappedPlugin = wrapPlugin(plugin);
let consoleWarnings = [];
beforeEach(() => {
    consoleWarnings = [];
    console.warn = v => consoleWarnings.push(v);
});

function testChanged(msg, source, expectedOutput, options) {
    test(msg, () => {
        const result = wrappedPlugin(source, options);
        expect(result).toBe(expectedOutput);
        expect(consoleWarnings).toEqual([]);
    });
}

testChanged(
    'does not change if chai is not imported',
    `
// @flow
assert.equal(foo, bar, baz);
`,
    `
// @flow
assert.equal(foo, bar, baz);
`
);

testChanged(
    'does not change if assert is not imported from chai',
    `
// @flow
import { should } from 'chai';
`,
    `
// @flow
import { should } from 'chai';
`
);

testChanged(
    'does not change if assert is not required from chai',
    `
// @flow
const should = require('chai').should;
`,
    `
// @flow
const should = require('chai').should;
`
);

const mappings = [
    // follow the ordering here: http://chaijs.com/api/assert/
    ['assert(foo === bar, baz);', 'expect(foo === bar).toBeTruthy();'],
    ['assert(Array.isArray([]));', 'expect(Array.isArray([])).toBeTruthy();'],
    ['assert.fail(foo, bar, baz);', 'expect(false).toBe(true);'],
    ['assert.isOk(foo, msg);', 'expect(foo).toBeTruthy();'],
    ['assert.isNotOk(foo);', 'expect(foo).toBeFalsy();'],
    ['assert.equal(foo, bar, baz);', 'expect(foo).toEqual(bar);'],
    ['assert.notEqual(foo, bar, baz);', 'expect(foo).not.toEqual(bar);'],
    ['assert.strictEqual(foo, bar, baz);', 'expect(foo).toBe(bar);'],
    ['assert.notStrictEqual(foo, bar, baz);', 'expect(foo).not.toBe(bar);'],
    ['assert.deepEqual(foo, bar, baz);', 'expect(foo).toEqual(bar);'],
    ['assert.notDeepEqual(foo, bar, baz);', 'expect(foo).not.toEqual(bar);'],
    ['assert.isAbove(foo, bar, baz);', 'expect(foo).toBeGreaterThan(bar);'],
    ['assert.isAtLeast(foo, bar, baz);', 'expect(foo).toBeGreaterThanOrEqual(bar);'],
    ['assert.isBelow(foo, bar, baz);', 'expect(foo).toBeLessThan(bar);'],
    ['assert.isAtMost(foo, bar, baz);', 'expect(foo).toBeLessThanOrEqual(bar);'],
    ['assert.isTrue(foo);', 'expect(foo).toBe(true);'],
    ['assert.isTrue(foo, msg);', 'expect(foo).toBe(true);'],
    ['assert.isNotTrue(foo, msg);', 'expect(foo).not.toBe(true);'],
    ['assert.isFalse(foo, msg);', 'expect(foo).toBe(false);'],
    ['assert.isNotFalse(foo, msg);', 'expect(foo).not.toBe(false);'],
    ['assert.isNull(foo, msg);', 'expect(foo).toBeNull();'],
    ['assert.isNotNull(foo, msg);', 'expect(foo).not.toBeNull();'],
    ['assert.isNaN(foo, msg);', 'expect(foo).toBe();'],
    ['assert.isNotNaN(foo, msg);', 'expect(foo).not.toBe();'],
    ['assert.isUndefined(foo, msg);', 'expect(foo).not.toBeDefined();'],
    ['assert.isDefined(foo, msg);', 'expect(foo).toBeDefined();'],
    ['assert.isFunction(foo, msg);', "expect(typeof foo).toBe('function');"],
    ['assert.isNotFunction(foo, msg);', "expect(typeof foo).not.toBe('function');"],
    ['assert.isObject(foo, msg);', "expect(typeof foo).toBe('object');"],
    ['assert.isNotObject(foo, msg);', "expect(typeof foo).not.toBe('object');"],
    ['assert.isArray(foo, msg);', 'expect(Array.isArray(foo)).toBe(true);'],
    ['assert.isNotArray(foo, msg);', 'expect(Array.isArray(foo)).not.toBe(true);'],
    ['assert.isString(foo, msg);', "expect(typeof foo).toBe('string');"],
    ['assert.isNotString(foo, msg);', "expect(typeof foo).not.toBe('string');"],
    ['assert.isNumber(foo, msg);', "expect(typeof foo).toBe('number');"],
    ['assert.isNotNumber(foo, msg);', "expect(typeof foo).not.toBe('number');"],
    ['assert.isBoolean(foo, msg);', "expect(typeof foo).toBe('boolean');"],
    ['assert.isNotBoolean(foo, msg);', "expect(typeof foo).not.toBe('boolean');"],
    ['assert.typeOf(foo, bar, baz);', 'expect(typeof foo).toBe(bar);'],
    ['assert.notTypeOf(foo, bar, baz);', 'expect(typeof foo).not.toBe(bar);'],
    ['assert.instanceOf(foo, bar, baz);', 'expect(foo).toBeInstanceOf(bar);'],
    ['assert.notInstanceOf(foo, bar, baz);', 'expect(foo).not.toBeInstanceOf(bar);'],
    ['assert.include(foo, bar, baz);', 'expect(foo).toContain(bar);'],
    ['assert.notInclude(foo, bar, baz);', 'expect(foo).not.toContain(bar);'],
    ['assert.match(foo, bar, baz);', 'expect(foo).toMatch(bar);'],
    ['assert.notMatch(foo, bar, baz);', 'expect(foo).not.toMatch(bar);'],
    ['assert.property(foo, bar, baz);', 'expect(bar in foo).toBeTruthy();'],
    ['assert.notProperty(foo, bar, baz);', 'expect(bar in foo).toBeFalsy();'],
    [
        "assert.deepProperty({ tea: { green: 'matcha' }}, 'tea.green');",
        "expect({ tea: { green: 'matcha' }}).toHaveProperty('tea.green');",
    ],
    [
        "assert.notDeepProperty({ tea: { green: 'matcha' }}, 'tea.oolong');",
        "expect({ tea: { green: 'matcha' }}).not.toHaveProperty('tea.oolong');",
    ],
    ['assert.propertyVal(foo, bar, baz);', 'expect(foo.bar).toBe(baz);'],
    ['assert.propertyNotVal(foo, bar, baz);', 'expect(foo.bar).not.toBe(baz);'],
    ['assert.notPropertyVal(foo, bar, baz);', 'expect(foo.bar).not.toBe(baz);'],
    [
        "assert.deepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'matcha' });",
        "expect({ tea: { green: 'matcha' } }).toHaveProperty('tea', { green: 'matcha' });",
    ],
    [
        "assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { black: 'matcha' });",
        "expect({ tea: { green: 'matcha' } }).not.toHaveProperty('tea', { black: 'matcha' });",
    ],
    [
        "assert.deepPropertyNotVal({ tea: { green: 'matcha' } }, 'tea', { green: 'oolong' });",
        "expect({ tea: { green: 'matcha' } }).not.toHaveProperty('tea', { green: 'oolong' });",
    ],
    [
        "assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'oolong' });",
        "expect({ tea: { green: 'matcha' } }).not.toHaveProperty('tea', { green: 'oolong' });",
    ],
    [
        "assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'coffee', { green: 'matcha' });",
        "expect({ tea: { green: 'matcha' } }).not.toHaveProperty('coffee', { green: 'matcha' });",
    ],
    ['assert.lengthOf(foo, bar, baz);', 'expect(foo.length).toBe(bar);'],
    ['assert.throws(foo, bar, baz);', 'expect(foo).toThrow();'],
    ['assert.doesNotThrow(foo, bar, baz);', 'expect(foo).not.toThrow();'],
    [
        'assert.closeTo(foo, bar, baz, msg);',
        'expect(Math.abs(foo - bar)).toBeLessThanOrEqual(baz);',
    ],
    [
        'assert.approximately(foo, bar, baz);',
        'expect(Math.abs(foo - bar)).toBeLessThanOrEqual(baz);',
    ],
    ['assert.sameMembers(foo, bar, baz);', 'expect(foo).toEqual(bar);'],
    ['assert.sameDeepMembers(foo, bar, baz);', 'expect(foo).toEqual(bar);'],
    [
        'assert.includeMembers([1, 2, 3], [2, 1, 2]);',
        'expect([1, 2, 3]).toEqual(expect.arrayContaining([2, 1, 2]));',
    ],
    [
        'assert.notIncludeMembers([1, 2, 3], [5, 1]);',
        'expect([1, 2, 3]).not.toEqual(expect.arrayContaining([5, 1]));',
    ],
    [
        'assert.includeDeepMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ b: 2 }, { a: 1 }, { b: 2 }]);',
        'expect([{ a: 1 }, { b: 2 }, { c: 3 }]).toEqual(expect.arrayContaining([{ b: 2 }, { a: 1 }, { b: 2 }]));',
    ],
    ['assert.isExtensible(foo);', 'expect(Object.isExtensible(foo)).toBe(true);'],
    ['assert.isNotExtensible(foo);', 'expect(Object.isExtensible(foo)).not.toBe(true);'],
    ['assert.isSealed(foo);', 'expect(Object.isSealed(foo)).toBe(true);'],
    ['assert.isNotSealed(foo);', 'expect(Object.isSealed(foo)).not.toBe(true);'],
    ['assert.isFrozen(foo);', 'expect(Object.isFrozen(foo)).toBe(true);'],
    ['assert.isNotFrozen(foo);', 'expect(Object.isFrozen(foo)).not.toBe(true);'],
];

const mappingTest = mappings.reduce(
    (test, [assert, expect]) => ({
        input: `
${test.input}
${assert}
`,
        output: `
${test.output}
${expect}
`,
    }),
    {
        input: `
// @flow
import { assert } from 'chai';`,
        output: `
// @flow`,
    }
);

testChanged('mappings', mappingTest.input, mappingTest.output);

testChanged(
    'mapping without import if skipImportDetection is set',
    mappingTest.input.replace("import { assert } from 'chai';\n", ''),
    mappingTest.output,
    { skipImportDetection: true }
);

test('not supported assertions', () => {
    const unsupportedAssertions = [
        'operator',
        'changes',
        'doesNotChange',
        'increases',
        'doesNotIncrease',
        'decreases',
        'doesNotDecrease',
        'ifError',
    ];

    const fileInput = unsupportedAssertions.reduce(
        (input, assertion) =>
            `${input}
assert.${assertion}(foo, bar, baz);`,
        "import { assert } from 'chai';"
    );

    wrappedPlugin(fileInput);

    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 2) Unsupported Chai Assertion "operator".',
        'jest-codemods warning: (test.js line 3) Unsupported Chai Assertion "changes".',
        'jest-codemods warning: (test.js line 4) Unsupported Chai Assertion "doesNotChange".',
        'jest-codemods warning: (test.js line 5) Unsupported Chai Assertion "increases".',
        'jest-codemods warning: (test.js line 6) Unsupported Chai Assertion "doesNotIncrease".',
        'jest-codemods warning: (test.js line 7) Unsupported Chai Assertion "decreases".',
        'jest-codemods warning: (test.js line 8) Unsupported Chai Assertion "doesNotDecrease".',
        'jest-codemods warning: (test.js line 9) Unsupported Chai Assertion "ifError".',
    ]);
});

testChanged(
    'applies when chai default import used',
    `
// @flow
import chai from 'chai';
chai.assert.equal(foo, bar, baz);
`,
    `
// @flow
expect(foo).toEqual(bar);
`
);

testChanged(
    'transforms renamed imports',
    `
// @flow
import { assert as myCoolAssert } from 'chai';
myCoolAssert.equal(foo, bar, baz);
`,
    `
// @flow
expect(foo).toEqual(bar);
`
);
