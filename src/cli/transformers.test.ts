/* eslint-env jest */
/* eslint-disable jest/expect-expect */
import { jest } from '@jest/globals'
import fs from 'fs'
import path from 'path'

let execaReturnValue
jest.setMock('execa', {
  sync: () => execaReturnValue,
})

const { executeTransformations, jscodeshiftExecutable, transformerDirectory } =
  await import('./transformers')

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
})

it('finds transformer directory', () => {
  fs.lstatSync(transformerDirectory)
})

it('finds jscodeshift executable', () => {
  fs.lstatSync(jscodeshiftExecutable)
})

it('runs jscodeshift for the given transformer', () => {
  execaReturnValue = { stderr: null }
  executeTransformations({
    files: 'src',
    flags: {},
    parser: 'flow',
    transformers: ['tape'],
  })
  expect(console.log).toHaveBeenCalledWith(
    `Executing command: jscodeshift -t ${path.join(
      transformerDirectory,
      'tape.js'
    )} src --ignore-pattern node_modules --parser flow`
  )
})

it('supports jscodeshift flags', () => {
  execaReturnValue = { stderr: null }
  executeTransformations({
    files: 'folder',
    flags: { dry: true },
    parser: 'flow',
    transformers: ['ava'],
  })
  expect(console.log).toHaveBeenCalledWith(
    `Executing command: jscodeshift -t ${path.join(
      transformerDirectory,
      'ava.js'
    )} folder --dry --ignore-pattern node_modules --parser flow`
  )
})

it('supports typescript parser', () => {
  execaReturnValue = { stderr: null }
  executeTransformations({
    files: 'folder',
    flags: { dry: true },
    parser: 'tsx',
    transformers: ['ava'],
  })
  expect(console.log).toHaveBeenCalledWith(
    `Executing command: jscodeshift -t ${path.join(
      transformerDirectory,
      'ava.js'
    )} folder --dry --ignore-pattern node_modules --parser tsx --extensions=tsx,ts`
  )
})

it('supports jscodeshift custom arguments', () => {
  execaReturnValue = { stderr: null }
  executeTransformations({
    files: 'folder',
    flags: { dry: true },
    parser: 'babel',
    transformers: ['ava'],
    transformerArgs: ['--standaloneMode', 'true'],
  })
  expect(console.log).toHaveBeenCalledWith(
    `Executing command: jscodeshift -t ${path.join(
      transformerDirectory,
      'ava.js'
    )} folder --dry --ignore-pattern node_modules --parser babel --standaloneMode true`
  )
})

it('rethrows jscodeshift errors', () => {
  const transformerError = new Error('bum')
  execaReturnValue = { stderr: transformerError }
  expect(() => {
    executeTransformations({
      files: 'src',
      flags: {},
      parser: 'flow',
      transformers: ['tape'],
    })
  }).toThrow(transformerError)
})
