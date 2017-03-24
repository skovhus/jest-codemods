/* eslint-env jest */
import chalk from 'chalk';
import { wrapPlugin } from '../utils/test-helpers';
import plugin from './chai-expect';

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

const mappings = [
  ['expect(\'123\').to.eql(\'123\');', 'expect(\'123\').toEqual(\'123\');'],
  ['expect(\'123\').to.not.eql(\'123\');', 'expect(\'123\').not.toEqual(\'123\');'],
  ['expect(foo).to.exist;', 'expect(foo).toEqual(expect.anything());'],
  ['expect(bar).to.not.exist;', 'expect(bar).not.toEqual(expect.anything());'],
  ['expect(1.00001 + 0.0002).to.be.closeTo(1, 0.5);', 'expect(1.00001 + 0.0002).toBeCloseTo(1, 1);'],
  ['expect(1.00001 + 0.0002).to.be.closeTo(1, 0.01);', 'expect(1.00001 + 0.0002).toBeCloseTo(1, 2);'],
  ['expect(1.00001 + 0.0002).not.to.be.closeTo(1, 0.5);', 'expect(1.00001 + 0.0002).not.toBeCloseTo(1, 1);'],
  ['expect(foo + bar).to.be.false;', 'expect(foo + bar).toBeFalsy();'],
  ['expect(10).to.be.above(5);', 'expect(10).toBeGreaterThan(5);'],
  ['expect(10).to.be.at.least(10);', 'expect(10).toBeGreaterThanOrEqual(10);'],
  ['expect(3).to.be.at.below(5);', 'expect(3).toBeLessThan(5);'],
  ['expect(5).to.be.at.most(5);', 'expect(5).toBeLessThanOrEqual(5);'],
  ['expect(123).to.be.instanceof(Number);', 'expect(123).toBeInstanceOf(Number);'],
  ['expect(\'123\').to.not.be.instanceof(Number);', 'expect(\'123\').not.toBeInstanceOf(Number);'],
  ['expect(undefined).to.not.be.null;', 'expect(undefined).not.toBeNull();'],
  ['expect(1).to.be.true;', 'expect(1).toBeTruthy();'],
  ['expect(1).not.to.be.true;', 'expect(1).not.toBeTruthy();'],
  ['expect(undefined).to.be.undefined;', 'expect(undefined).toBeUndefined();'],
  ['expect([ 1, 2, 3]).to.have.lengthOf(3);', 'expect([ 1, 2, 3]).toHaveLength(3);'],
  ['expect(\'foobar\').to.match(/^foo/);', 'expect(\'foobar\').toMatch(/^foo/);'],
  ['expect(deepObj).to.have.deep.property(\'green.tea\', \'matcha\');', 'expect(deepObj).toHaveProperty(\'green.tea\', \'matcha\');'],
  ['expect(obj).to.have.property(\'foo\');', 'expect(obj).toHaveProperty(\'foo\');'],
];

const mappingTest = mappings.reduce((test, [assert, expect]) => ({
    input: `${test.input}
    ${assert}
    `,
    output: `${test.output}
    ${expect}
    `,
}), {
    input: '',
    output: '',
});

testChanged('mappings', mappingTest.input, mappingTest.output);
