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
  t.ifError(abc)
})
`,
`
it('mapping', () => {
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
  expect(abc).toBeFalsy()
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
it(() => {});
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
fit(() => {});
xit(() => {});

xit(() => {});
xit(() => {});
fit(() => {});
fit(() => {});
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

test.serial.only('handles done.fail and done.pass', t => {
    setTimeout(() => {
        t.fail('no');
        t.pass('yes');
    }, 500);
});
`,
`
it('handles done.fail and done.pass', done => {
    setTimeout(() => {
        done.fail('no');
    }, 500);
});

fit('handles done.fail and done.pass', done => {
    setTimeout(() => {
        done.fail('no');
    }, 500);
});
`);

// TODO: semantics is not the same for t.end and done
// t.end automatically checks for error as first argument (jasmine doesn't)
testChanged('callback tests',
`
import test from 'ava';
test.cb(t => {
    fs.readFile('data.txt', t.end);
});
`,
`
it(done => {
    fs.readFile('data.txt', done);
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
        'jest-codemods warning: (test.js line 4) Skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 7) Skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 8) Skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 9) Skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 11) Skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 12) Skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 13) Skipping setup/teardown hooks is currently not supported',
        'jest-codemods warning: (test.js line 14) Skipping setup/teardown hooks is currently not supported',
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
        'jest-codemods warning: (test.js line 3) Argument to test function should be named "t" not "x"',
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


test('warns about unknown AVA functions', () => {
    wrappedPlugin(`
        import test from 'ava';
        test.todo(t => {});
        test.failing(t => {});
    `);
    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 3) Unknown AVA method "todo"',
        'jest-codemods warning: (test.js line 4) Unknown AVA method "failing"',
    ]);
});
