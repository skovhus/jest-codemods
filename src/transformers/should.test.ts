/* eslint-env jest */
import chalk from 'chalk'

import { wrapPlugin } from '../utils/test-helpers'
import plugin from './should'

chalk.level = 0

const wrappedPlugin = wrapPlugin(plugin)
let consoleWarnings = []
beforeEach(() => {
  consoleWarnings = []
  console.warn = (v) => consoleWarnings.push(v)
})

function assertTransformation(source, expectedOutput) {
  const result = wrappedPlugin(source)
  expect(result).toBe(expectedOutput)
  expect(consoleWarnings).toEqual([])
}

test('removes imports and does basic conversions of should.js', () => {
  assertTransformation(
    `
        var should = require('should');

        var user = {
            name: 'tj'
          , pets: ['tobi', 'loki', 'jane', 'bandit']
        };

        user.should.have.property('name', 'tj');
        should(user).have.property('name', 'tj');
        should(true).ok;
        should.throws(foo, /^Description/);
        should(foo).be.undefined();
    `,
    `
        var user = {
            name: 'tj'
          , pets: ['tobi', 'loki', 'jane', 'bandit']
        };

        expect(user).toHaveProperty('name', 'tj');
        expect(user).toHaveProperty('name', 'tj');
        expect(true).toBeTruthy();
        expect(foo).toThrowError(/^Description/);
        expect(foo).toBeUndefined();
    `
  )
})

test('leaves code without should/expect', () => {
  assertTransformation(
    `
        function test() {
            i.have.a.dream();
            i.have.a.dream;
        }
        `,
    null
  )
})
