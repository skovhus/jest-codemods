/* eslint-env jest */
import path from 'path';
import chalk from 'chalk';
import { defineTest } from 'jscodeshift/dist/testUtils';
import { wrapPlugin } from '../utils/test-helpers';
import plugin from './chai-should';

chalk.enabled = false;

const wrappedPlugin = wrapPlugin(plugin);
let consoleWarnings = [];
beforeEach(() => {
    consoleWarnings = [];
    console.warn = v => consoleWarnings.push(v);
});

const transformersPath = path.join(__dirname, 'transformers');

const createTest = name => {
    defineTest(transformersPath, 'chai-should', null, path.join('chai-should', name));
};

defineTest(transformersPath, 'chai-should', null, 'chai-should');

createTest('a-an');
createTest('above');
createTest('below');
createTest('eql');
createTest('equal');
createTest('exist-defined');
createTest('false');
createTest('include-contain');
createTest('instanceof');
createTest('keys');
createTest('least');
createTest('lengthof');
createTest('match');
createTest('members');
createTest('most');
createTest('nan');
createTest('null');
createTest('ok');
createTest('ownproperty');
createTest('ownpropertydescriptor');
createTest('throw');
createTest('true');
createTest('undefined');
createTest('within');

function testChanged(_msg, _source, _expectedOutput) {
    let msg = _msg;
    let source = _source;
    let expectedOutput = _expectedOutput;

    if (!expectedOutput) {
        msg = 'chai-should';
        source = _msg;
        expectedOutput = _source;
    }

    test(msg, () => {
        const result = wrappedPlugin(source);
        expect(result).toBe(expectedOutput);
        expect(consoleWarnings).toEqual([]);
    });
}

testChanged(
    'expect("123").to.eql("123");',
    'expect("123").toEqual("123");'
);

testChanged(
    'expect("123").to.not.eql("123");',
    'expect("123").not.toEqual("123");'
);

testChanged(
    'expect(foo).to.exist;',
    'expect(foo).toBeDefined();'
);

testChanged(
    'expect(bar).to.not.exist;',
    'expect(bar).toBeFalsy();'
);

testChanged(
    'expect(foo + bar).to.be.false;',
    'expect(foo + bar).toBe(false);'
);

testChanged(
    'expect(10).to.be.above(5);',
    'expect(10).toBeGreaterThan(5);'
);

testChanged(
    'expect(10).to.be.at.least(10);',
    'expect(10).toBeGreaterThanOrEqual(10);'
);

testChanged(
    'expect(3).to.be.at.below(5);',
    'expect(3).toBeLessThan(5);'
);

testChanged(
    'expect(5).to.be.at.most(5);',
    'expect(5).toBeLessThanOrEqual(5);'
);

testChanged(
    'expect(123).to.be.instanceof(Number);',
    'expect(123).toBeInstanceOf(Number);'
);

testChanged(
    'expect("123").to.not.be.instanceof(Number);',
    'expect("123").not.toBeInstanceOf(Number);'
);

testChanged(
    'expect(undefined).to.not.be.null;',
    'expect(undefined).not.toBeNull();'
);

testChanged(
    'expect(1).to.be.true;',
    'expect(1).toBe(true);'
);

testChanged(
    'expect(1).not.to.be.true;',
    'expect(1).not.toBe(true);'
);

testChanged(
    'expect(undefined).to.be.undefined;',
    'expect(undefined).toBeUndefined();'
);

testChanged(
    'expect([ 1, 2, 3]).to.have.lengthOf(3);',
    'expect([ 1, 2, 3]).toHaveLength(3);'
);

testChanged(
    'expect("foobar").to.match(/^foo/);',
    'expect("foobar").toMatch(/^foo/);'
);

testChanged(
    'expect(deepObj).to.have.deep.property("green.tea", "matcha");',
    'expect(deepObj).toHaveProperty("green.tea", "matcha");'
);

testChanged(
    'expect(obj).to.have.property("foo");',
    'expect(obj).toHaveProperty("foo");'
);

testChanged(
    'expect(obj).to.have.property("foo", "bar");',
    'expect(obj).toHaveProperty("foo", "bar");'
);

test('not supported assertions', () => {
    wrappedPlugin(`
        expect([1, 2, 3]).to.have.any.keys([1, 2]);
        expect(arguments).to.be.arguments;
        expect(arguments).not.to.be.arguments;
        expect(obj).to.respondTo('bar');
        expect(1).to.satisfy(function(num) { return num > 0; });
        expect(fn).to.closeTo(obj, 'val');
        expect([3]).to.not.be.oneOf([1, 2, [3]]);
        expect(fn).to.change(obj, 'val');
        expect(fn).to.increase(obj, 'val');
        expect(fn).to.decrease(obj, 'val');
        expect(nonExtensibleObject).to.not.be.extensible;
        expect(sealedObject).to.be.sealed;
        expect(sealedObject).to.be.frozen;
    `);

    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 2) Unsupported Chai Assertion "any.keys"',
        'jest-codemods warning: (test.js line 3) Unsupported Chai Assertion "arguments"',
        'jest-codemods warning: (test.js line 4) Unsupported Chai Assertion "arguments"',
        'jest-codemods warning: (test.js line 5) Unsupported Chai Assertion "respondTo"',
        'jest-codemods warning: (test.js line 6) Unsupported Chai Assertion "satisfy"',
        'jest-codemods warning: (test.js line 7) Unsupported Chai Assertion "closeTo"',
        'jest-codemods warning: (test.js line 8) Unsupported Chai Assertion "oneOf"',
        'jest-codemods warning: (test.js line 9) Unsupported Chai Assertion "change"',
        'jest-codemods warning: (test.js line 10) Unsupported Chai Assertion "increase"',
        'jest-codemods warning: (test.js line 11) Unsupported Chai Assertion "decrease"',
        'jest-codemods warning: (test.js line 12) Unsupported Chai Assertion "extensible"',
        'jest-codemods warning: (test.js line 13) Unsupported Chai Assertion "sealed"',
        'jest-codemods warning: (test.js line 14) Unsupported Chai Assertion "frozen"',
    ]);
});
