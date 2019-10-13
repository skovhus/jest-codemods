/* eslint-env jest */

import jscodeshift from 'jscodeshift'

import detectQuoteStyle from './quote-style'

const j = jscodeshift

it('detects single quote', () => {
  const ast = j(`
        const x = require('foo');
        x();
    `)
  const style = detectQuoteStyle(j, ast)
  expect(style).toBe('single')
})

it('detects double quote', () => {
  const ast = j(`
        import test from "tape";
        test("mytest", t => {
            t.ok("msg");
        });
    `)
  const style = detectQuoteStyle(j, ast)
  expect(style).toBe('double')
})

it('detects nothing', () => {
  const ast = j('const x = 1;')
  const style = detectQuoteStyle(j, ast)
  expect(style).toBe(null)
})
