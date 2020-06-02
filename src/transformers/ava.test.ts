/* eslint-env jest */
import chalk from 'chalk'

import { wrapPlugin } from '../utils/test-helpers'
import plugin from './ava'

chalk.level = 0
const wrappedPlugin = wrapPlugin(plugin)

let consoleWarnings = []
beforeEach(() => {
  consoleWarnings = []
  console.warn = v => consoleWarnings.push(v)
})

function testChanged(msg, source, expectedOutput, options = {}) {
  test(msg, () => {
    const result = wrappedPlugin(source, options)
    expect(result).toBe(expectedOutput)
    expect(consoleWarnings).toEqual([])
  })
}

testChanged(
  'does not touch code without ava require/import',
  `
// @flow
const test = require("testlib");
test(t => {
    t.notOk(1);
})
`,
  `
// @flow
const test = require("testlib");
test(t => {
    t.notOk(1);
})
`
)

testChanged(
  'changes code without require/import if skipImportDetection is set',
  `
// @flow
test(t => {
    t.notOk(1);
})
`,
  `
// @flow
test(t => {
    expect(1).toBeFalsy();
})
`,
  { skipImportDetection: true }
)

// TODO: jscodeshift adds semi colon when preserving first line comments :/
testChanged(
  'maps assertions',
  `
// @flow
import test from 'ava'

test('mapping', (t) => {
  const abc = { a: 'a', b: 'b', c: 'c' }
  t.ok(abc)
  t.truthy(abc)
  t.notOk(abc)
  t.falsy(abc)
  t.true(abc)
  t.false(abc)
  t.is(abc, 'abc')
  t.not(abc, 'xyz')
  t.same(abc, {a: 'a', b: 'b', c: 'c'})
  t.deepEqual(abc, {a: 'a', b: 'b', c: 'c'})
  t.throws(() => {}, 'foo');
  t.throws(afunc, 'foo');
  t.throws(afunc);
  t.notThrows(() => {}, 'foo');
  t.notThrows(() => {});
  t.notSame(abc, {a: 'x', b: 'y', c: 'z'})
  t.notDeepEqual(abc, {a: 'x', b: 'y', c: 'z'})
  t.notRegex(abc, /xyz/)
  t.regex(abc, /abc/)
  t.ifError(abc)
  t.error(abc)
  t.plan(3)
  t.snapshot(abc)
  t.snapshot(abc, "msg")
  t.snapshot(abc, {id: 'foo'})
  t.snapshot(abc, {}, "msg")
})
`,
  `
// @flow
test('mapping', () => {
  const abc = { a: 'a', b: 'b', c: 'c' }
  expect(abc).toBeTruthy()
  expect(abc).toBeTruthy()
  expect(abc).toBeFalsy()
  expect(abc).toBeFalsy()
  expect(abc).toBe(true)
  expect(abc).toBe(false)
  expect(abc).toBe('abc')
  expect(abc).not.toBe('xyz')
  expect(abc).toEqual({a: 'a', b: 'b', c: 'c'})
  expect(abc).toEqual({a: 'a', b: 'b', c: 'c'})
  expect(() => {}).toThrowError('foo');
  expect(afunc).toThrowError('foo');
  expect(afunc).toThrow();
  expect(() => {}).not.toThrowError('foo');
  expect(() => {}).not.toThrow();
  expect(abc).not.toEqual({a: 'x', b: 'y', c: 'z'})
  expect(abc).not.toEqual({a: 'x', b: 'y', c: 'z'})
  expect(abc).not.toMatch(/xyz/)
  expect(abc).toMatch(/abc/)
  expect(abc).toBeFalsy()
  expect(abc).toBeFalsy()
  expect.assertions(3)
  expect(abc).toMatchSnapshot()
  expect(abc).toMatchSnapshot("msg")
  expect(abc).toMatchSnapshot()
  expect(abc).toMatchSnapshot("msg")
});
`
)

testChanged(
  'handles test setup/teardown modifiers',
  `
import test from 'ava'

test.before(t => {});
test.after(t => {});
test.beforeEach(t => {});
test.afterEach(t => {});
`,
  `
beforeAll(() => {});
afterAll(() => {});
beforeEach(() => {});
afterEach(() => {});
`
)

testChanged(
  'all tests are serial by default',
  `
import test from 'ava'
test.serial(t => {});
`,
  `
test(() => {});
`
)

testChanged(
  'handles skip/only modifiers and chaining',
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
`
)

testChanged(
  'removes t.pass, but keeps t.fail',
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
test('handles done.fail and done.pass', done => {
    setTimeout(() => {
        done.fail('no');
    }, 500);
});

test.only('handles done.fail and done.pass', done => {
    setTimeout(() => {
        done.fail('no');
    }, 500);
});
`
)

// TODO: semantics is not the same for t.end and done
// t.end automatically checks for error as first argument (jasmine doesn't)
testChanged(
  'callback tests',
  `
import test from 'ava';
test.cb(t => {
    fs.readFile('data.txt', t.end);
});
`,
  `
test(done => {
    fs.readFile('data.txt', done);
});
`
)

// TODO: these hanging t variables should be removed or be renamed
testChanged(
  'passing around t',
  `
import test from 'ava'

test('should pass', t => {
    shouldFail(t, 'hi')
    return shouldFail2(t, 'hi')
})

function shouldFail(t, message) {
    t.same('error', message)
}

function shouldFail2(t, message) {
    return Promise.reject().catch(err => {
        t.same(err.message, message)
    })
}
`,
  `
test('should pass', () => {
    shouldFail(t, 'hi')
    return shouldFail2(t, 'hi')
})

function shouldFail(t, message) {
    expect('error').toEqual(message)
}

function shouldFail2(t, message) {
    return Promise.reject().catch(err => {
        expect(err.message).toEqual(message)
    });
}
`
)

testChanged(
  'keeps async and await',
  `
import test from 'ava';

test(async (t) => {
    const value = await promiseFn();
    t.true(value);
});

test(async function (t) {
    const value = await promiseFn();
    t.true(value);
});
`,
  `
test(async () => {
    const value = await promiseFn();
    expect(value).toBe(true);
});

test(async function () {
    const value = await promiseFn();
    expect(value).toBe(true);
});
`
)

testChanged(
  'destructured test argument',
  `
import test from 'ava';
test(({ok}) => {
    ok('msg');
});
test('my test', ({is}) => {
    is('msg', 'other msg');
});
`,
  `
test(() => {
    expect('msg').toBeTruthy();
});
test('my test', () => {
    expect('msg').toBe('other msg');
});
`
)

testChanged(
  'converts test.todo',
  `
import test from 'ava';
test.todo('this should be a test some day');
`,
  `
test.todo('this should be a test some day');
`
)

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
    `)

  expect(consoleWarnings).toEqual([
    'jest-codemods warning: (test.js line 4) Skipping setup/teardown hooks is currently not supported',
    'jest-codemods warning: (test.js line 7) Skipping setup/teardown hooks is currently not supported',
    'jest-codemods warning: (test.js line 8) Skipping setup/teardown hooks is currently not supported',
    'jest-codemods warning: (test.js line 9) Skipping setup/teardown hooks is currently not supported',
    'jest-codemods warning: (test.js line 11) Skipping setup/teardown hooks is currently not supported',
    'jest-codemods warning: (test.js line 12) Skipping setup/teardown hooks is currently not supported',
    'jest-codemods warning: (test.js line 13) Skipping setup/teardown hooks is currently not supported',
    'jest-codemods warning: (test.js line 14) Skipping setup/teardown hooks is currently not supported',
  ])
})

test('not supported warnings: unmapped t property', () => {
  wrappedPlugin(`
        import test from 'ava';
        test(t => {
            t.unknownAssert(100);
        });
    `)
  expect(consoleWarnings).toEqual([
    'jest-codemods warning: (test.js line 4) "t.unknownAssert" is currently not supported',
  ])
})

test('not supported warnings: non standard argument for test', () => {
  wrappedPlugin(`
        import test from 'ava';
        test(x => {
            x.equal(1, 1);
        });
    `)
  expect(consoleWarnings).toEqual([
    'jest-codemods warning: (test.js line 3) Argument to test function should be named "t" not "x"',
  ])
})

test('warns about some conflicting packages', () => {
  wrappedPlugin(`
        import ava from 'ava';
        import proxyquire from 'proxyquire';
        import testdouble from 'testdouble';
        test(t => {});
    `)
  expect(consoleWarnings).toEqual([
    'jest-codemods warning: (test.js) Usage of package "testdouble" might be incompatible with Jest',
  ])
})

test('warns about unknown AVA functions', () => {
  wrappedPlugin(`
        import test from 'ava';
        test.failing(t => {});
    `)
  expect(consoleWarnings).toEqual([
    'jest-codemods warning: (test.js line 3) Unknown AVA method "failing"',
  ])
})

test('warns about too few AVA arguments', () => {
  wrappedPlugin(`
        import test from 'ava';
        test(t => {
          t.is(1);
        });
    `)
  expect(consoleWarnings).toEqual([
    'jest-codemods warning: (test.js line 4) "t.is" should have 2 arguments',
  ])
})

testChanged(
  'supports renaming non standard import name',
  `
import foo from 'ava';
foo(() => {});
`,
  `
test(() => {});
`
)
