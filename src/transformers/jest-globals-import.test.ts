/* eslint-env jest */
import fs from 'fs'
import * as jscodeshift from 'jscodeshift'
import { applyTransform } from 'jscodeshift/src/testUtils'
import path from 'path'

import { JEST_GLOBALS } from '../utils/consts'
import * as plugin from './jest-globals-import'

function expectTransformation(source: string, expectedOutput: string | null) {
  const result = applyTransform({ ...plugin, parser: 'ts' }, {}, { source })
  expect(result).toBe(expectedOutput ?? '')
}

describe('jestGlobalsImport', () => {
  it("matches @jest/globals' types", () => {
    const jestGlobalsPath = path.join(
      __dirname,
      '../../node_modules/@jest/globals/build/index.d.ts'
    )

    const jestGlobals = new Set<string>()

    const j = jscodeshift.withParser('ts')
    const jestGlobalsAst = j(String(fs.readFileSync(jestGlobalsPath)))

    jestGlobalsAst
      .find(j.ExportNamedDeclaration, { declaration: { declare: true } })
      .forEach((exportNamedDec) => {
        if (exportNamedDec.node.declaration?.type !== 'VariableDeclaration') return
        exportNamedDec.node.declaration.declarations.forEach((dec) => {
          if (dec.type !== 'VariableDeclarator' || dec.id?.type !== 'Identifier') return
          jestGlobals.add(dec.id.name)
        })
      })

    jestGlobalsAst
      .find(j.ExportSpecifier, { exported: { name: (n) => typeof n === 'string' } })
      .forEach((exportSpecifier) => {
        jestGlobals.add(exportSpecifier.node.exported.name)
      })

    expect(jestGlobals).toEqual(JEST_GLOBALS)
  })

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

  it('removes unnecessary imports', () => {
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
    expectTransformation(
      `
import { expect } from '@jest/globals';
const BLAH = 5;
expect(BLAH).toBe(5);
`.trim(),
      `
import { expect } from '@jest/globals';
const BLAH = 5;
expect(BLAH).toBe(5);
`.trim()
    )
    expectTransformation(
      `
import '@jest/globals';
const BLAH = 5;
expect(BLAH).toBe(5);
`.trim(),
      `
import { expect } from '@jest/globals';
const BLAH = 5;
expect(BLAH).toBe(5);
`.trim()
    )
  })

  it('covers a less simple test', () => {
    expectTransformation(
      `
import { expect as xpect, it } from '@jest/globals';
import wrapWithStuff from 'test-utils/wrapWithStuff';

describe('with foo=bar', () => {
  wrapWithStuff({ foo: 'bar' });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('works', () => {
    xpect(myThingIsEnabled(jest.fn())).toBe(true);
    expect(1).toBe(1);
  });
});
`.trim(),
      `
import { expect as xpect, it, afterEach, beforeEach, describe, jest } from '@jest/globals';
import wrapWithStuff from 'test-utils/wrapWithStuff';

describe('with foo=bar', () => {
  wrapWithStuff({ foo: 'bar' });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('works', () => {
    xpect(myThingIsEnabled(jest.fn())).toBe(true);
    expect(1).toBe(1);
  });
});
`.trim()
    )
  })
})
