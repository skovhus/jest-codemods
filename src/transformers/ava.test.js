/* eslint-env jest */
import { wrapPlugin } from '../utils/test-helpers';
import plugin from './ava';

const wrappedPlugin = wrapPlugin(plugin);

function testChanged(msg, source, expectedOutput) {
    test(msg, () => {
        const result = wrappedPlugin(source);
        expect(result).toBe(expectedOutput);
    });
}

let consoleWarnings = [];
beforeEach(() => {
    consoleWarnings = [];
    console.warn = v => consoleWarnings.push(v);
});

testChanged('does not touch code without ava require/import',
`
const test = require("testlib");
test(t => {
    t.notOk(1);
});`,
`
const test = require("testlib");
test(t => {
    t.notOk(1);
});`
);

testChanged('maps assertions',
`
import test from 'ava'

test('mapping', (t) => {
  const abc = { a: 'a', b: 'b', c: 'c' }
  t.truthy(abc)
  t.falsy(abc)
  t.true(abc)
  t.false(abc)
  t.is(abc, 'abc')
  t.not(abc, 'xyz')
  t.deepEqual(abc, {a: 'a', b: 'b', c: 'c'})
  t.throws(() => {}, 'foo');
  t.throws(afunc, 'foo');
  t.throws(afunc);
  t.notThrows(() => {});
  t.notDeepEqual(abc, {a: 'x', b: 'y', c: 'z'})
  t.notRegex(abc, /xyz/)
  t.regex(abc, /abc/)
})
`,
`
test('mapping', () => {
  const abc = { a: 'a', b: 'b', c: 'c' }
  expect(abc).toBeTruthy()
  expect(abc).toBeFalsy()
  expect(abc).toBe(true)
  expect(abc).toBe(false)
  expect(abc).toBe('abc')
  expect(abc).not.toBe('xyz')
  expect(abc).toEqual({a: 'a', b: 'b', c: 'c'})
  expect(() => {}).toThrowError('foo');
  expect(afunc).toThrowError('foo');
  expect(afunc).toThrow();
  expect(() => {}).not.toThrow();
  expect(abc).not.toEqual({a: 'x', b: 'y', c: 'z'})
  expect(abc).not.toMatch(/xyz/)
  expect(abc).toMatch(/abc/)
})
`);

testChanged('handles test setup/teardown modifiers',
`
import test from 'ava'

test.before(t => {});
test.after(t => {});
test.beforeEach(t => {});
test.afterEach(t => {});
`,
`
before(() => {});
after(() => {});
beforeEach(() => {});
afterEach(() => {});
`);

testChanged('all tests are serial by default',
`
import test from 'ava'
test.serial(t => {});
`,
`
test(() => {});
`);

testChanged('handles skip/only modifiers and chaining',
`
import test from 'ava'

test.only(t => {});
test.skip(t => {});

test.serial.skip(t => {});
test.skip.serial(t => {});
test.only.serial(t => {});
test.serial.only(t => {});
`,
`
test.only(() => {});
test.skip(() => {});

test.skip(() => {});
test.skip(() => {});
test.only(() => {});
test.only(() => {});
`);

testChanged('removes t.pass, but keeps t.fail',
`
import test from 'ava'

test('handles done.fail and done.pass', t => {
    setTimeout(() => {
        t.fail('no');
        t.pass('yes');
    }, 500);
});
`,
`
test('handles done.fail and done.pass', done => {
    setTimeout(() => {
        done.fail('no');
    }, 500);
});
`);

test('not supported warnings: skipping test setup/teardown hooks', () => {
    wrappedPlugin(`
        import test from 'ava'

        test.before.skip(() => {
            this.x = '';
        });
        test.after.skip(() => {});
        test.afterEach.skip(() => {});
        test.skip.beforeEach(() => {});

        test.skip.before(() => {});
        test.skip.after(() => {});
        test.skip.afterEach(() => {});
        test.beforeEach.skip(() => {});
    `);

    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 4) skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 7) skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 8) skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 9) skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 10) skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 11) skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 12) skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 13) skipping setup/teardown hooks is currently not supported',
    ]);
});

test('not supported warnings: t.fail', () => {
    wrappedPlugin(`
        import test from 'ava';
        test.skip(function(t) {
            t.fail();
        });
    `);
    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 4) "fail" is currently not supported',
    ]);
});

test('not supported warnings: non standard argument for test', () => {
    wrappedPlugin(`
        import test from 'ava';
        test(x => {
            x.equal(1, 1);
        });
    `);
    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 3) argument to test function should be named "t" not "x"',
    ]);
});

test('warns about some conflicting packages', () => {
    wrappedPlugin(`
        import test from 'ava';
        import test from 'proxyquire';
        import test from 'testdouble';
        test(t => {});
    `);
    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js) Usage of package "proxyquire" might be incompatible with Jest',
        'jest-codemods warning: (test.js) Usage of package "testdouble" might be incompatible with Jest',
    ]);
});
