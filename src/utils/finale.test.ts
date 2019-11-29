/* eslint-env jest */
import chalk from 'chalk'
import jscodeshift from 'jscodeshift'

import finale from './finale'

chalk.level = 0

let consoleWarnings = []
beforeEach(() => {
  consoleWarnings = []
  console.warn = v => consoleWarnings.push(v)
})

function testChanged(msg, source, expectedOutput, options = {}, expectedErrors = []) {
  test(msg, () => {
    const j = jscodeshift
    const ast = j(source)
    const result = finale({ path: 'test.js' }, j, ast, options)
    expect(result).toBe(expectedOutput)
    expect(consoleWarnings).toEqual(expectedErrors)
  })
}

testChanged(
  'preserves quote style (double)',
  `
    import test from "tape";
    test("mytest", t => {
        t.ok("msg");
    });
    `,
  `
    import test from "tape";
    test("mytest", t => {
        t.ok("msg");
    });
    `
)

testChanged(
  'preserves quote style (single)',
  `
    import test from 'tape';
    test('mytest', t => {
        t.ok('msg');
    });
    `,
  `
    import test from 'tape';
    test('mytest', t => {
        t.ok('msg');
    });
    `
)

testChanged(
  'standaloneMode: rewrites spy calls (import)',
  `
    // @flow
    import expect from 'expect';

    test(() => {
        var spy1 = jest.fn();
        var spy2 = jest.spyOn(video, 'play');
        jest.spyOn(video, 'play');
        expect(1).toBe(1);
    });
    `,
  `
    import mock from 'jest-mock';
    // @flow
    import expect from 'expect';

    test(() => {
        var spy1 = mock.fn();
        var spy2 = mock.spyOn(video, 'play');
        mock.spyOn(video, 'play');
        expect(1).toBe(1);
    });
    `,
  {
    standaloneMode: true,
  }
)

testChanged(
  'standaloneMode: add expect import when standaloneMode',
  `
    test(() => {
        expect(1).toBe(1);
    });
    `,
  `
    import expect from 'expect';
    test(() => {
        expect(1).toBe(1);
    });
    `,
  {
    standaloneMode: true,
  }
)

testChanged(
  'standaloneMode: adds expect and jest-mock imports when standaloneMode',
  `
    test(() => {
        var spy1 = jest.fn();
        expect(1).toBe(1);
    });
    `,
  `
    import mock from 'jest-mock';
    import expect from 'expect';
    test(() => {
        var spy1 = mock.fn();
        expect(1).toBe(1);
    });
    `,
  {
    standaloneMode: true,
  }
)

const unsupportedExample = `
    import sinon from 'sinon';
    import testdouble from 'testdouble';
`
testChanged(
  'warns about incompatible packages',
  unsupportedExample,
  unsupportedExample,
  {},
  [
    'jest-codemods warning: (test.js) Usage of package "sinon" might be incompatible with Jest',
    'jest-codemods warning: (test.js) Usage of package "testdouble" might be incompatible with Jest',
  ]
)
