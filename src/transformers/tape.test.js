/* eslint-disable import/no-extraneous-dependencies */
/* eslint-env jest */
import 'babel-polyfill';

import { wrapPlugin } from '../utils/test-helpers';
import plugin from './tape';

const wrappedPlugin = wrapPlugin(plugin);

function testChanged(msg, source, expectedOutput) {
    test(msg, () => {
        const result = wrappedPlugin(source);
        expect(result).toBe(expectedOutput);
    });
}

testChanged('does not touch code without tape require/import',
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

testChanged('CommonJs requires',
`
const test = require(\'tape\');
const x = 1;
`,
`
const x = 1;
`
);


testChanged('ES2015 imports',
`
import test from \'tape\';
const x = 1;
`,
`
const x = 1;
`
);

testChanged('maps assertions and comments',
`
import test from 'tape';
test((t) => {
    // t.fail('msg');
    // t.pass('msg');
    t.ok(1, 'msg');
    t.true(1, 'msg');
    t.assert(1, 2, 'msg');
    t.notOk(1, 'msg');
    t.false(1, 'msg');
    t.notok(1, 'msg');
    // t.error(1, 'msg');
    // t.ifErr(1, 'msg');
    // t.iferror(1, 'msg');
    t.equal(1, 2, 'msg');
    t.equals(1, 2, 'msg');
    t.isEqual(1, 2, 'msg');
    t.strictEqual(1, 2, 'msg');
    t.strictEquals(1, 2, 'msg');

    t.notEqual(1, 2, 'msg');
    t.notStrictEqual(1, 2, 'msg');
    t.notStrictEquals(1, 2, 'msg');
    t.isNotEqual(1, 2, 'msg');
    t.doesNotEqual(1, 2, 'msg');
    t.isInequal(1, 2, 'msg');

    t.deepEqual(app.x, {foo: 2}, 'msg');
    t.isEquivalent(1, 2, 'msg');
    t.same(1, 2, 'msg');

    t.notDeepEqual(1, 2, 'msg');
    t.notEquivalent(1, 2, 'msg');
    t.notDeeply(1, 2, 'msg');
    t.notSame(1, 2, 'msg');
    t.isNotDeepEqual(1, 2, 'msg');
    t.isNotEquivalent(1, 2, 'msg');
    t.isInequivalent(1, 2, 'msg');

    // t.skip('msg');
    t.throws(1, 'msg');
    t.doesNotThrow(1, 'msg');
    // t.comment('this is a comment...');
});
`,
`
test(() => {
    // t.fail('msg');
    // t.pass('msg');
    expect(1).toBeTruthy();
    expect(1).toBeTruthy();
    expect(1).toBeTruthy();
    expect(1).toBeFalsy();
    expect(1).toBeFalsy();
    expect(1).toBeFalsy();
    // t.error(1, 'msg');
    // t.ifErr(1, 'msg');
    // t.iferror(1, 'msg');
    expect(1).toBe(2);
    expect(1).toBe(2);
    expect(1).toBe(2);
    expect(1).toBe(2);
    expect(1).toBe(2);

    expect(1).not.toBe(2);
    expect(1).not.toBe(2);
    expect(1).not.toBe(2);
    expect(1).not.toBe(2);
    expect(1).not.toBe(2);
    expect(1).not.toBe(2);

    expect(app.x).toEqual({foo: 2});
    expect(1).toEqual(2);
    expect(1).toEqual(2);

    expect(1).not.toEqual(2);
    expect(1).not.toEqual(2);
    expect(1).not.toEqual(2);
    expect(1).not.toEqual(2);
    expect(1).not.toEqual(2);
    expect(1).not.toEqual(2);
    expect(1).not.toEqual(2);

    // t.skip('msg');
    expect(1).toThrow();
    expect(1).not.toThrow();
    // t.comment('this is a comment...');
});
`);

testChanged('preserves quote style',
`
import test from "tape";
test("mytest", t => {
    t.ok("msg");
});
`,
`
test("mytest", () => {
    expect("msg").toBeTruthy();
});
`
);

testChanged('rewriting non standard naming of test function and t argument',
`
import myTapeTest from "tape";
myTapeTest("mytest", t => {
    t.ok("msg");
});

myTapeTest((t) => {
    t.ok("msg");
});

myTapeTest("mytest", function(t) {
    t.ok("msg");
});

myTapeTest(function(t) {
    t.ok("msg");
});
`,
`
test("mytest", () => {
    expect("msg").toBeTruthy();
});

test(() => {
    expect("msg").toBeTruthy();
});

test("mytest", function() {
    expect("msg").toBeTruthy();
});

test(function() {
    expect("msg").toBeTruthy();
});
`
);

testChanged('test options: removes',
`
import test from 'tape';
test('mytest', {objectPrintDepth: 4, skip: false}, t => {
    t.ok('msg');
});
`,
`
test('mytest', () => {
    expect('msg').toBeTruthy();
});
`
);

testChanged('test options: skip',
`
import test from 'tape';
test('mytest', {objectPrintDepth: 4, skip: true}, t => {
    t.ok('msg');
});
`,
`
xit('mytest', () => {
    expect('msg').toBeTruthy();
});
`
);

testChanged('removes t.end in scope of test function',
`
import test from 'tape';
test('mytest', t => {
    t.equal(1, 1);
    t.end();
});
`,
`
test('mytest', () => {
    expect(1).toBe(1);
});
`
);

/*
testChanged('removes t.end in scope of test function',
`
import test from 'tape';
test('store: save exising', function(t) {
    setTimeout(() => {
        t.end();
    }, 0);
});
`,
`
test('mytest', t => {
    expect(1).toBe(1);
    setTimeout(() => {
        t.end();
    }, 500);
});
`
);
*/

testChanged('t.throws',
`
import test from 'tape';
test(t => {
    t.throws(myfunc, 'should not throw');
    t.throws(myfunc, 'xxx', 'should not throw');
    t.throws(myfunc, /err_reg_exp/i);
    t.throws(myfunc, /err_reg_exp/i, 'should not throw');
});
`,
`
test(() => {
    expect(myfunc).toThrow();
    expect(myfunc).toThrowError('xxx');
    expect(myfunc).toThrowError(/err_reg_exp/i);
    expect(myfunc).toThrowError(/err_reg_exp/i);
});
`
);

/*
// FIXME: test these
test.serial('not supported warnings: createStream', t => {
    wrapped(`
        import test from 'tape';
        test.createStream(() => {});
        test.createStream(() => {}); // only logs once
    `);
    t.is(t.context.consoleWarnings.length, 1, 'one warnings logged');
    t.is(
        t.context.consoleWarnings[0],
        'tape-to-jest warning: (test.js line 3) "createStream" is not supported'
    );
});

test.serial('not supported warnings: onFinish', t => {
    wrapped(`
        import test from 'tape';
        test.onFinish(() => {});
    `);
    t.is(t.context.consoleWarnings.length, 1, 'one warnings logged');
    t.is(
        t.context.consoleWarnings[0],
        'tape-to-jest warning: (test.js line 3) "onFinish" is not supported'
    );
});

test.serial('not supported: timeoutAfter', t => {
    wrapped(`
        import test from 'tape';
        test(t => {
            t.timeoutAfter(100);
        });
    `);
    t.is(t.context.consoleWarnings.length, 1, 'one warnings logged');
    t.is(
        t.context.consoleWarnings[0],
        'tape-to-jest warning: (test.js line 4) "timeoutAfter" is not supported'
    );
});

test.serial('not supported: looseEquals', t => {
    wrapped(`
        import test from 'tape';
        test(t => {
            t.looseEquals({}, {});
        });
    `);
    t.is(t.context.consoleWarnings.length, 1, 'one warnings logged');
    t.is(
        t.context.consoleWarnings[0],
        'tape-to-jest warning: (test.js line 4) "looseEquals" is not supported. Try the stricter "deepEqual" or "notDeepEqual"'
    );
});

test.serial('not supported: timeout option', t => {
    wrapped(`
        import test from 'tape';
        test({timeout: 42}, t => {
            t.pass();
        });
    `);
    t.is(t.context.consoleWarnings.length, 1, 'one warnings logged');
    t.is(
        t.context.consoleWarnings[0],
        'tape-to-jest warning: (test.js line 3) "timeout" option is not supported'
    );
});

test.serial('not supported: non standard argument for test', t => {
    wrapped(`
        import test from 'tape';
        test(x => {
            x.pass();
        });
    `);
    t.is(t.context.consoleWarnings.length, 1, 'one warnings logged');
    t.is(
        t.context.consoleWarnings[0],
        'tape-to-jest warning: (test.js line 3) argument to test function should be named "t" not "x"'
    );
});

test.serial('not supported: non standard argument for test.skip', t => {
    wrapped(`
        import test from 'tape';
        test.skip(function(y) {
            y.pass();
        });
    `);
    t.is(t.context.consoleWarnings.length, 1, 'one warnings logged');
    t.is(
        t.context.consoleWarnings[0],
        'tape-to-jest warning: (test.js line 3) argument to test function should be named "t" not "y"'
    );
});

*/
