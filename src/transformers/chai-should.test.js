/* eslint-env jest */
import chalk from 'chalk';
import { wrapPlugin } from '../utils/test-helpers';
import plugin from './chai-should';

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
    ['foo.should.not.equal(bar);', 'expect(foo).to.not.equal(bar);'],
    ['goodFn.should.not.throw(Error);', 'expect(goodFn).to.not.throw(Error);'],
    ['({ foo: \'baz\' }).should.have.property(\'foo\').and.not.equal(\'bar\');', 'expect({ foo: \'baz\' }).to.have.property(\'foo\').and.not.equal(\'bar\');'],
    ['foo.should.deep.equal({ bar: \'baz\' });', 'expect(foo).to.deep.equal({ bar: \'baz\' });'],
    ['foo.should.have.any.keys(\'bar\', \'baz\');', 'expect(foo).to.have.any.keys(\'bar\', \'baz\');'],
    ['foo.should.have.all.keys(\'bar\', \'baz\');', 'expect(foo).to.have.all.keys(\'bar\', \'baz\');'],
    ['(\'test\').should.be.a(\'string\');', 'expect(\'test\').to.be.a(\'string\');'],
    ['([1,2,3]).should.include(2);', 'expect([1,2,3]).to.include(2);'],
    ['(\'foobar\').should.contain(\'foo\');', 'expect(\'foobar\').to.contain(\'foo\');'],
    ['(true).should.be.true', 'expect(true).to.be.true'],
    ['should.exist(foo.bar);', 'expect(foo.bar).to.exist;'],
    ['should.exist(foo);', 'expect(foo).to.exist;'],
    ['should.not.exist(bar);', 'expect(bar).to.not.exist;'],
    ['({}).should.be.empty;', 'expect({}).to.be.empty;'],
    ['({ foo: \'bar\' }).should.eql({ foo: \'bar\' });', 'expect({ foo: \'bar\' }).to.eql({ foo: \'bar\' });'],
    ['([ 1, 2, 3 ]).should.eql([ 1, 2, 3 ]);', 'expect([ 1, 2, 3 ]).to.eql([ 1, 2, 3 ]);'],
    ['([ 1, 2, 3 ]).should.have.length.above(2);', 'expect([ 1, 2, 3 ]).to.have.length.above(2);'],
    ['(10).should.be.at.least(10);', 'expect(10).to.be.at.least(10);'],
    ['(\'foo\').should.have.length.within(2,4);', 'expect(\'foo\').to.have.length.within(2,4);'],
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

console.log(mappingTest.input);

testChanged('mappings @dev', mappingTest.input, mappingTest.output);
