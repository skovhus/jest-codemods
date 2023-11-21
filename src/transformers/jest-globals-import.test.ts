/* eslint-env jest */
import { applyTransform } from 'jscodeshift/src/testUtils'

import * as plugin from './jest-globals-import'

function expectTransformation(source: string, expectedOutput: string | null) {
  const result = applyTransform({ ...plugin, parser: 'ts' }, {}, { source })
  expect(result).toBe(expectedOutput ?? '')
}

describe('jestGlobalsImport', () => {
  it('covers a simple test', () => {
    expectTransformation(
      `
it('works', () => {
  expect(true).toBe(true);
});
`.trim(),
      `
import { expect, it } from '@jest/globals';
it('works', () => {
  expect(true).toBe(true);
});
`.trim()
    )
  })

  it('ignores locally defined variables with the same name', () => {
    expectTransformation(
      `
const test = () => { console.log('only a test'); };
{
  function b() {
    function c() {
      test();
    }
  }
}
`.trim(),
      null
    )
  })

  it('removes imports', () => {
    expectTransformation(
      `
import '@jest/globals';
const BLAH = 5;
`.trim(),
      `
const BLAH = 5;
`.trim()
    )
    expectTransformation(
      `
import { expect } from '@jest/globals';
const BLAH = 5;
`.trim(),
      `
const BLAH = 5;
`.trim()
    )
    expectTransformation(
      `
import * as jestGlobals from '@jest/globals';
const BLAH = 5;
`.trim(),
      `
const BLAH = 5;
`.trim()
    )
  })

  it('covers a less simple test', () => {
    expectTransformation(
      `
import { expect, it } from '@jest/globals';
import wrapWithStuff from 'test-utils/wrapWithStuff';

describe('with foo=bar', () => {
  wrapWithStuff({ foo: 'bar' });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('works', () => {
    expect(myThingIsEnabled(jest.fn())).toBe(true);
  });
});
`.trim(),
      `
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import wrapWithStuff from 'test-utils/wrapWithStuff';

describe('with foo=bar', () => {
  wrapWithStuff({ foo: 'bar' });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('works', () => {
    expect(myThingIsEnabled(jest.fn())).toBe(true);
  });
});
`.trim()
    )
  })
})
