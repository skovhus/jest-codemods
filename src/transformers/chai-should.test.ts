/* eslint-env jest */
import chalk from 'chalk'

import { wrapPlugin } from '../utils/test-helpers'
import plugin from './chai-should'

chalk.level = 0

const wrappedPlugin = wrapPlugin(plugin)
let consoleWarnings = []
beforeEach(() => {
  consoleWarnings = []
  console.warn = (v) => consoleWarnings.push(v)
})

function expectTransformation(source, expectedOutput) {
  const result = wrappedPlugin(source)
  expect(result).toBe(expectedOutput)
  expect(consoleWarnings).toEqual([])
}

test('removes imports and does basic conversions of should and expect', () => {
  expectTransformation(
    `
        var expect = require('chai').expect;

        describe('Instantiating TextField', () => {
            it('should set the placeholder correctly', () => {
                expect(textField.props.placeholder).to.equal(PLACEHOLDER);
                expect(textField.props.placeholder).to.not.equal(PLACEHOLDER);
            });
        });
    `,
    `
        describe('Instantiating TextField', () => {
            it('should set the placeholder correctly', () => {
                expect(textField.props.placeholder).toBe(PLACEHOLDER);
                expect(textField.props.placeholder).not.toBe(PLACEHOLDER);
            });
        });
    `
  )
})

test('removes imports and does basic conversions of should and expect (2)', () => {
  expectTransformation(
    `
        const { expect } = require('chai');
        var should = require('chai').should();

        describe('Instantiating TextField', () => {
            it('should set the placeholder correctly', () => {
                textField.props.placeholder.should.equal(PLACEHOLDER);
                textField.props.placeholder.should.not.equal(PLACEHOLDER);
            });

            it('should inherit id prop', () => {
                dropdown.props.id.should.equal(STANDARD_PROPS.id);
                dropdown.props.id.should.not.equal(STANDARD_PROPS.id);
            });

            it('should map open prop to visible prop', () => {
                dropdown.props.visible.should.Throw(STANDARD_PROPS.open);
                dropdown.props.id.should.not.Throw(STANDARD_PROPS.id);
            });

            thing1.equal(thing2);
        });
    `,
    `
        describe('Instantiating TextField', () => {
            it('should set the placeholder correctly', () => {
                expect(textField.props.placeholder).toBe(PLACEHOLDER);
                expect(textField.props.placeholder).not.toBe(PLACEHOLDER);
            });

            it('should inherit id prop', () => {
                expect(dropdown.props.id).toBe(STANDARD_PROPS.id);
                expect(dropdown.props.id).not.toBe(STANDARD_PROPS.id);
            });

            it('should map open prop to visible prop', () => {
                expect(dropdown.props.visible).toThrowError(STANDARD_PROPS.open);
                expect(dropdown.props.id).not.toThrowError(STANDARD_PROPS.id);
            });

            thing1.equal(thing2);
        });
    `
  )
})

test('removes imports (case where should is not assigned)', () => {
  expectTransformation(
    `
        require('chai').should();

        describe('Instantiating TextField', () => {
          it('should set the placeholder correctly', () => {
              textField.props.placeholder.should.equal(PLACEHOLDER);
              textField.props.placeholder.should.not.equal(PLACEHOLDER);
          });
        });`,
    `
        describe('Instantiating TextField', () => {
          it('should set the placeholder correctly', () => {
              expect(textField.props.placeholder).toBe(PLACEHOLDER);
              expect(textField.props.placeholder).not.toBe(PLACEHOLDER);
          });
        });`
  )
})

test('Removes complicated import', () => {
  expectTransformation(
    `
        const chai = require('chai');
        const expect = chai.expect;

        expect(foo).to.be.true;
    `,
    `
        expect(foo).toBe(true);
    `
  )
})

test('converts "a-an"', () => {
  expectTransformation(
    `
        expect('test').to.be.a('string', 'error message');
        expect({ foo: 'bar' }).to.be.an('object');
        expect({ foo: 'bar' }).to.be.an(Object);
        expect('xyz').to.be.a(String);
        expect(null).to.be.a('null');
        expect(undefined).to.be.an('undefined');
        expect(new Error()).to.be.an('error');
        expect(new Promise()).to.be.a('promise');
        expect(new Float32Array()).to.be.a('float32array');
        expect(Symbol()).to.be.a('symbol');
        expect(new Date()).to.be.a('Date');
        expect(bar).to.be.an('object');
        expect(foo).to.not.be.an('object');
        expect(foo).to.be.an('array');
        expect(baz).to.not.be.an('array');

        'test'.should.be.a('string');
    `,
    `
        expect(typeof 'test').toBe('string');
        expect({ foo: 'bar' }).toBeInstanceOf(Object);
        expect({ foo: 'bar' }).toBeInstanceOf(Object);
        expect('xyz').toBeInstanceOf(String);
        expect(null).toBeNull();
        expect(undefined).toBeUndefined();
        expect(new Error()).toBeInstanceOf(Error);
        expect(new Promise()).toBeInstanceOf(Promise);
        expect(new Float32Array()).toBeInstanceOf(Float32Array);
        expect(Symbol()).toBeInstanceOf(Symbol);
        expect(new Date()).toBeInstanceOf(Date);
        expect(bar).toBeInstanceOf(Object);
        expect(foo).not.toBeInstanceOf(Object);
        expect(Array.isArray(foo)).toBe(true);
        expect(Array.isArray(baz)).toBe(false);

        expect(typeof 'test').toBe('string');
    `
  )
})

test('converts "above"', () => {
  expectTransformation(
    `
        expect(10).to.be.above(5);
        expect(10).to.be.gt(5);
        expect(10).to.be.greaterThan(5);
    `,
    `
        expect(10).toBeGreaterThan(5);
        expect(10).toBeGreaterThan(5);
        expect(10).toBeGreaterThan(5);
    `
  )
})

test('converts "below"', () => {
  expectTransformation(
    `
        expect(5).to.be.below(10);
        expect(5).to.be.below(10, 'error message');
        expect(3).to.be.at.below(5);
        expect(2).to.be.lessThan(5);
        expect(2).to.be.lt(5);
        (1).should.be.lessThan(5);
        (1).should.be.lt(5);
    `,
    `
        expect(5).toBeLessThan(10);
        expect(5).toBeLessThan(10);
        expect(3).toBeLessThan(5);
        expect(2).toBeLessThan(5);
        expect(2).toBeLessThan(5);
        expect(1).toBeLessThan(5);
        expect(1).toBeLessThan(5);
    `
  )
})

test('converts "eql"', () => {
  expectTransformation(
    `
        expect({ foo: 'bar' }).to.eql({ foo: 'bar' });
        expect([1, 2, 3]).to.eql([1, 2, 3]);
        a.should.eql(a);

        expect("123").to.eql("123");
        expect("123").to.not.eql("123");
    `,
    `
        expect({ foo: 'bar' }).toEqual({ foo: 'bar' });
        expect([1, 2, 3]).toEqual([1, 2, 3]);
        expect(a).toEqual(a);

        expect("123").toBe("123");
        expect("123").not.toBe("123");
    `
  )
})

test('converts "equal"', () => {
  expectTransformation(
    `
        expect('hello').to.equal('hello');
        expect('hello', 'some message here explaining hello').to.equal('hello');
        expect(42).to.equal(42);
        expect(1).to.not.equal(true);
        expect({ foo: 'bar' }).to.not.equal({ foo: 'bar' });
        expect({ foo: 'bar' }).to.deep.equal({ foo: 'bar' });

        should.equal('foo', 'foo');
        should.not.equal('foo', 'bar');
    `,
    `
        expect('hello').toBe('hello');
        // some message here explaining hello
        expect('hello').toBe('hello');
        expect(42).toBe(42);
        expect(1).not.toBe(true);
        expect({ foo: 'bar' }).not.toBe({ foo: 'bar' });
        expect({ foo: 'bar' }).toEqual({ foo: 'bar' });

        expect('foo').toBe('foo');
        expect('foo').not.toBe('bar');
    `
  )
})

test('converts "exist-defined"', () => {
  expectTransformation(
    `
        expect(foo).to.exist;
        expect(bar).to.not.exist;
        expect(baz).to.not.exist;
        expect(input).exist;

        expect(foo).to.be.defined;
        expect(foo).not.to.be.defined;
        expect(foo).to.not.be.defined;

        should.exist('');
    `,
    `
        expect(foo).toBeDefined();
        expect(bar).toBeFalsy();
        expect(baz).toBeFalsy();
        expect(input).toBeDefined();

        expect(foo).toBeDefined();
        expect(foo).not.toBeDefined();
        expect(foo).toBeFalsy();

        expect('').toBeDefined();
    `
  )
})

test('converts "extensible"', () => {
  expectTransformation(
    `
        expect(nonExtensibleObject).to.not.be.extensible;
        expect({}).to.be.extensible;
        expect({}).to.be.extensible();
        x.should.be.extensible;
        x.should.be.extensible();
    `,
    `
        expect(Object.isExtensible(nonExtensibleObject)).toBe(false);
        expect(Object.isExtensible({})).toBe(true);
        expect(Object.isExtensible({})).toBe(true);
        expect(Object.isExtensible(x)).toBe(true);
        expect(Object.isExtensible(x)).toBe(true);
    `
  )
})

test('converts "empty"', () => {
  expectTransformation(
    `
        expect([]).to.be.empty;
        expect('').to.be.empty;
        expect(v).to.be.empty;
        expect({}).to.be.empty;
        expect(wrapper.find('.failure-message').length).to.be.empty;
  `,
    `
        expect([]).toHaveLength(0);
        expect('').toHaveLength(0);
        expect(Object.keys(v)).toHaveLength(0);
        expect(Object.keys({})).toHaveLength(0);
        expect(wrapper.find('.failure-message')).toHaveLength(0);
  `
  )
})

test('converts "false"', () => {
  expectTransformation(
    `
        expect(false).to.be.false;
        expect(0).to.not.be.false;
        expect(foo + bar).to.be.false;
    `,
    `
        expect(false).toBe(false);
        expect(0).not.toBe(false);
        expect(foo + bar).toBe(false);
    `
  )
})

test('converts "finite"', () => {
  expectTransformation(
    `
        (Infinity).should.not.be.finite;
        (-10).should.be.finite;
    `,
    `
        expect(isFinite(Infinity)).toBe(false);
        expect(isFinite(-10)).toBe(true);
    `
  )
})

test('converts "frozen"', () => {
  expectTransformation(
    `
        expect(frozenObject).to.be.frozen;
        expect({}).to.not.be.frozen;
    `,
    `
        expect(Object.isFrozen(frozenObject)).toBe(true);
        expect(Object.isFrozen({})).toBe(false);
    `
  )
})

test('converts "string"', () => {
  expectTransformation(
    `
        expect('foobar').to.have.string('bar');
        expect('foobar').not.to.have.string('z');
        expect(someString).to.have.string('bar');
        expect(someString).not.to.have.string('bar');
    `,
    `
        expect('foobar').toContain('bar');
        expect('foobar').not.toContain('z');
        expect(someString).toContain('bar');
        expect(someString).not.toContain('bar');
    `
  )
})

test('converts "includes-contains"', () => {
  expectTransformation(
    `
        expect('foobar').to.contain('foo');
        expect([1, 2, 3]).to.include(2);
        expect('foobar').which.contains('foo');
        expect({ foo: 1, bar: 2 }).to.contain({ bar: 2 });
    `,
    `
        expect('foobar').toContain('foo');
        expect([1, 2, 3]).toEqual(expect.arrayContaining([2]));
        expect('foobar').toContain('foo');
        expect({ foo: 1, bar: 2 }).toMatchObject({ bar: 2 });
    `
  )
})

test('converts chained "includes-contains"', () => {
  expectTransformation(
    `
        expect([1, 2, 3]).to.be.an('array').that.includes(2);
        expect(arr).to.be.an('array').that.does.not.include(3);
    `,
    `
        expect([1, 2, 3]).toEqual(expect.arrayContaining([2]));
        expect(arr).toEqual(expect.not.arrayContaining([3]));
    `
  )
})

test('converts empty array assertion', () => {
  expectTransformation(
    `
        expect(arr).to.be.an('array').that.is.empty;
    `,
    `
        expect(arr).toEqual([]);
    `
  )
})

test('converts "instanceof"', () => {
  expectTransformation(
    `
        expect(foo).to.be.an.instanceof(Foo);
        expect(foo).not.to.be.an.instanceof(Foo);
        expect(123).to.be.instanceof(Number);
    `,
    `
        expect(foo).toBeInstanceOf(Foo);
        expect(foo).not.toBeInstanceOf(Foo);
        expect(123).toBeInstanceOf(Number);
    `
  )
})

test('converts "keys"', () => {
  expectTransformation(
    `
        expect([1, 2, 3]).to.have.all.keys(1, 2);
        expect({ foo: 1, bar: 2 }).to.have.all.keys({ bar: 6, foo: 7 });
        expect({ foo: 1, bar: 2, baz: 3 }).to.contain.all.keys(['bar', 'foo']);
        expect({ foo: 1, bar: 2, baz: 3 }).to.contain.all.keys({ bar: 6 });
    `,
    `
        expect([1, 2, 3]).toEqual(expect.arrayContaining([1, 2]));
        expect(Object.keys({ foo: 1, bar: 2 })).toEqual(expect.arrayContaining(Object.keys({ bar: 6, foo: 7 })));
        expect(Object.keys({ foo: 1, bar: 2, baz: 3 })).toEqual(expect.arrayContaining(['bar', 'foo']));
        expect(Object.keys({ foo: 1, bar: 2, baz: 3 })).toEqual(expect.arrayContaining(Object.keys({ bar: 6 })));
    `
  )
})

test('converts "least"', () => {
  expectTransformation(
    `expect(10).to.be.at.least(10);`,
    `expect(10).toBeGreaterThanOrEqual(10);`
  )
})

test('converts "length"', () => {
  expectTransformation(
    `
        expect('foo').to.have.length(3);
        expect([1,2]).to.have.length(2);

        expect('foo').to.have.length.of.at.most(4);
        expect([1,2]).to.have.length.of.at.most(4);
        expect(anArray).to.have.length.above(2);
    `,
    `
        expect('foo').toHaveLength(3);
        expect([1,2]).toHaveLength(2);

        expect('foo'.length).toBeLessThanOrEqual(4);
        expect([1,2].length).toBeLessThanOrEqual(4);
        expect(anArray.length).toBeGreaterThan(2);
    `
  )
})

test('converts "lengthof"', () => {
  expectTransformation(
    `
        expect([1, 2, 3]).to.have.lengthOf(3);
        expect('foobar').to.have.lengthOf(6);
        'test'.should.have.lengthOf(4);
    `,
    `
        expect([1, 2, 3]).toHaveLength(3);
        expect('foobar').toHaveLength(6);
        expect('test').toHaveLength(4);
    `
  )
})

test('converts "match"', () => {
  expectTransformation(
    `expect('foobar').to.match(/^foo/);`,
    `expect('foobar').toMatch(/^foo/);`
  )
})

test('converts "members"', () => {
  expectTransformation(
    `
        expect([1, 2, 3]).to.include.members([3, 2]);
        expect([1, 2, 3]).to.not.include.members([3, 2, 8]);

        expect([4, 2]).to.have.members([2, 4], 'error message');
        expect([5, 2]).to.not.have.members([5, 2, 1]);

        expect([{ id: 1 }]).to.deep.include.members([{ id: 1 }]);

        expect({ id: 1 }).to.include.members({ id: 1 });
    `,
    `
        expect([1, 2, 3]).toEqual(expect.arrayContaining([3, 2]));
        expect([1, 2, 3]).not.toEqual(expect.arrayContaining([3, 2, 8]));

        expect([4, 2]).toEqual(expect.arrayContaining([2, 4]));
        expect([5, 2]).not.toEqual(expect.arrayContaining([5, 2, 1]));

        expect([{ id: 1 }]).toEqual(expect.arrayContaining([{ id: 1 }]));

        expect({ id: 1 }).toEqual(expect.objectContaining({ id: 1 }));
    `
  )
})

test('converts "most"', () => {
  expectTransformation(`expect(5).to.be.at.most(5);`, `expect(5).toBeLessThanOrEqual(5);`)
})

test('converts "nan"', () => {
  expectTransformation(
    `
        expect('foo').to.be.NaN;
        expect(4).not.to.be.NaN;
    `,
    `
        expect('foo').toBeNaN();
        expect(4).not.toBeNaN();
    `
  )
})

test('converts "null"', () => {
  expectTransformation(
    `
        expect(null).to.be.null;
        expect(undefined).to.not.be.null;
    `,
    `
        expect(null).toBeNull();
        expect(undefined).not.toBeNull();
    `
  )
})

test('converts "ok"', () => {
  expectTransformation(
    `
        expect('everything').to.be.ok;
        expect(1).to.be.ok;
        expect(false).to.not.be.ok;
        expect(undefined).to.not.be.ok;
        expect(null).to.not.be.ok;
        expect(null).to.not.be.ok();

        const x = { ok: true };
        assert.ok(x.ok);
        expect(x.ok).toBeTruthy();
        expect(x.ok).to.be.ok;
        `,
    `
        expect('everything').toBeTruthy();
        expect(1).toBeTruthy();
        expect(false).toBeFalsy();
        expect(undefined).toBeFalsy();
        expect(null).toBeFalsy();
        expect(null).toBeFalsy();

        const x = { ok: true };
        assert.ok(x.ok);
        expect(x.ok).toBeTruthy();
        expect(x.ok).toBeTruthy();
        `
  )
})

test('converts "ownproperty"', () => {
  expectTransformation(
    `expect('test').to.have.ownProperty('length')`,
    `expect('test'.hasOwnProperty('length')).toBeTruthy()`
  )
})

test('converts "ownpropertydescriptor"', () => {
  expectTransformation(
    `
        expect('test').to.have.ownPropertyDescriptor('length');
        expect('test').to.have.ownPropertyDescriptor('length', { enumerable: false, configurable: false, writable: false, value: 4 });
        expect('test').not.to.have.ownPropertyDescriptor('length', { enumerable: false, configurable: false, writable: false, value: 3 });
    `,
    `
        expect(Object.getOwnPropertyDescriptor('test', 'length')).not.toBeUndefined();
        expect(Object.getOwnPropertyDescriptor('test', 'length')).toEqual({ enumerable: false, configurable: false, writable: false, value: 4 });
        expect(Object.getOwnPropertyDescriptor('test', 'length')).toEqual({ enumerable: false, configurable: false, writable: false, value: 3 });
    `
  )
})

test('converts "property"', () => {
  expectTransformation(
    `
        expect(deepObj).to.have.deep.property("green.tea", "matcha");
        expect(obj).to.have.property("foo");
        expect(obj).to.have.property("foo", "bar");
    `,
    `
        expect(deepObj).toHaveProperty("green.tea", "matcha");
        expect(obj).toHaveProperty("foo");
        expect(obj).toHaveProperty("foo", "bar");
    `
  )
})

test('converts "sealed"', () => {
  expectTransformation(
    `
        expect(sealedObject).to.be.sealed;
        expect({}).to.not.be.sealed;
    `,
    `
        expect(Object.isSealed(sealedObject)).toBe(true);
        expect(Object.isSealed({})).toBe(false);
    `
  )
})

test('converts "throw"', () => {
  expectTransformation(
    `
        const err = new ReferenceError('This is a bad function.');
        const fn = function() { throw err; };
        expect(fn).to.throw(ReferenceError);
        expect(fn).to.throw(Error);
        expect(fn).to.throw(/bad function/);
        expect(fn).to.not.throw('good function');
        expect(fn).to.throw(ReferenceError, /bad function/);
        expect(fn).to.throw(err);
    `,
    `
        const err = new ReferenceError('This is a bad function.');
        const fn = function() { throw err; };
        expect(fn).toThrowError(ReferenceError);
        expect(fn).toThrowError(Error);
        expect(fn).toThrowError(/bad function/);
        expect(fn).not.toThrowError('good function');
        expect(fn).toThrowError(ReferenceError);
        expect(fn).toThrowError(err);
    `
  )
})

test('converts "true"', () => {
  expectTransformation(
    `
        expect(true).to.be.true;
        expect(1).to.not.be.true;
        expect(true).to.be.true();
    `,
    `
        expect(true).toBe(true);
        expect(1).not.toBe(true);
        expect(true).toBe(true);
    `
  )
})

test('converts "undefined"', () => {
  expectTransformation(
    `
        expect(undefined).to.be.undefined;
        expect(undefined).to.equal(undefined);
        expect(null).to.not.be.undefined;
        expect(null).to.not.be.undefined();
        expect(null).to.not.equal(undefined);
    `,
    `
        expect(undefined).toBeUndefined();
        expect(undefined).toBeUndefined();
        expect(null).toBeDefined();
        expect(null).toBeDefined();
        expect(null).toBeDefined();
    `
  )
})

test('converts "function"', () => {
  expectTransformation(
    `
        expect(foo).to.be.a.function;
    `,
    `
        expect(foo).toBeInstanceOf(Function);
    `
  )
})

it('warns about using chai extensions', () => {
  wrappedPlugin(`
        const chai = require('chai');
        const sinonChai = require('sinon-chai');
        chai.use(sinonChai);
        `)

  expect(consoleWarnings).toEqual([
    'jest-codemods warning: (test.js line 4) Unsupported Chai Extension "chai.use()"',
  ])
})

test('does not convert "empty"', () => {
  expectTransformation(
    `
        expect(foo.empty).to.be.undefined;
        const foo = rx.Observable.empty;
    `,
    `
        expect(foo.empty).toBeUndefined();
        const foo = rx.Observable.empty;
    `
  )
})

test('removes params to expect() except for the first', () => {
  expectTransformation(
    `
        expect(foo, 'Expected foo to be defined').to.exist;
        expect(foo, 'Expected foo to be defined').to.equal(true);
        expect(foo, \`Expected foo to be defined for \${id}\`).to.be.defined;
        expect(foo, 'Expected ' + foo + ' to be defined').to.equal(true);
    `,
    `
        // Expected foo to be defined
        expect(foo).toBeDefined();
        // Expected foo to be defined
        expect(foo).toBe(true);
        // Expected foo to be defined for \${id}
        expect(foo).toBeDefined();
        // 'Expected ' + foo + ' to be defined'
        expect(foo).toBe(true);
    `
  )
})

test('converts equal(null) to toBeNull()', () => {
  expectTransformation(
    `
        expect(actual).to.equal(null);
    `,
    `
        expect(actual).toBeNull();
    `
  )
})

test('converts "within"', () => {
  expectTransformation(
    `
        expect(7).to.be.within(5, 10);

        (5).should.be.within(2, 4);
    `,
    `
        expect(7).toBeGreaterThanOrEqual(5);
        expect(7).toBeLessThanOrEqual(10);

        expect(5).toBeGreaterThanOrEqual(2);

        expect(5).toBeLessThanOrEqual(4);
    `
  )
})

test('converts "within" with length', () => {
  expectTransformation(
    `
        expect('foo').to.have.length.within(2, 4);

        expect([1, 2, 3]).to.have.length.within(2, 4);

        expect('foo').to.have.length.within(2, 4, 'error message');
    `,
    `
        expect('foo'.length).toBeGreaterThanOrEqual(2);
        expect('foo'.length).toBeLessThanOrEqual(4);

        expect([1, 2, 3].length).toBeGreaterThanOrEqual(2);

        expect([1, 2, 3].length).toBeLessThanOrEqual(4);

        expect('foo'.length).toBeGreaterThanOrEqual(2);

        expect('foo'.length).toBeLessThanOrEqual(4);
    `
  )
})

it('warns about not supported assertions part 1', () => {
  wrappedPlugin(`
        expect([1, 2, 3]).to.have.any.keys([1, 2]);
        expect([4, 2]).to.have.ordered.members([2, 4]);
        expect(7).to.be.within(10);
        `)

  expect(consoleWarnings).toEqual([
    'jest-codemods warning: (test.js line 2) Unsupported Chai Assertion "any.keys"',
    'jest-codemods warning: (test.js line 3) Unsupported Chai Assertion "ordered"',
    'jest-codemods warning: (test.js line 4) .within needs at least two arguments',
  ])
})

it('warns about not supported assertions part 2', () => {
  wrappedPlugin(`
        expect(arguments).to.be.arguments;
        expect(arguments).not.to.be.arguments;
        expect(obj).to.respondTo('bar');
        expect(1).to.satisfy(function(num) { return num > 0; });
        expect(fn).to.closeTo(obj, 'val');
        expect([3]).to.not.be.oneOf([1, 2, [3]]);
        expect(fn).to.change(obj, 'val');
        expect(fn).to.increase(obj, 'val');
        expect(fn).to.decrease(obj, 'val');
        `)

  expect(consoleWarnings).toEqual([
    'jest-codemods warning: (test.js line 2) Unsupported Chai Assertion "arguments"',
    'jest-codemods warning: (test.js line 3) Unsupported Chai Assertion "arguments"',
    'jest-codemods warning: (test.js line 4) Unsupported Chai Assertion "respondTo"',
    'jest-codemods warning: (test.js line 5) Unsupported Chai Assertion "satisfy"',
    'jest-codemods warning: (test.js line 6) Unsupported Chai Assertion "closeTo"',
    'jest-codemods warning: (test.js line 7) Unsupported Chai Assertion "oneOf"',
    'jest-codemods warning: (test.js line 8) Unsupported Chai Assertion "change"',
    'jest-codemods warning: (test.js line 9) Unsupported Chai Assertion "increase"',
    'jest-codemods warning: (test.js line 10) Unsupported Chai Assertion "decrease"',
  ])
})

it('leaves code without should/expect', () => {
  const result = wrappedPlugin(`
        function test() {
            i.have.a.dream();
            i.have.a.dream;
        }
        const MESSAGES = {
            Ok: 'x',
            Cancel: 'y',
        };

        if (MESSAGES.Ok) {
            //
        };
        `)

  expect(result).toBeNull()
})

// TODO: warn about chaining not working
// E.g. expect({ foo: 'baz' }).to.have.property('foo').and.not.equal('bar');
