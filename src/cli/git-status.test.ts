/* eslint-env jest */
import { jest } from '@jest/globals'

import checkGitStatus from './git-status'

let gitStatusReturnValue: boolean | Error = false
jest.setMock('is-git-clean', {
  sync: () => {
    if (typeof gitStatusReturnValue === 'boolean') {
      return gitStatusReturnValue
    }
    throw gitStatusReturnValue
  },
})

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(console, 'warn').mockImplementation(() => {})
  jest.spyOn(process, 'exit').mockImplementation((() => {}) as any)
})

it('does not exit and output any logs when git repo is clean', () => {
  gitStatusReturnValue = true
  checkGitStatus()
  expect(console.log).not.toHaveBeenCalled()
  expect(process.exit).not.toHaveBeenCalled()
})

it('does not exit and output any logs when not a git repo', () => {
  const err = new Error() as any
  err.stderr = 'Not a git repository'
  gitStatusReturnValue = err
  checkGitStatus()
  expect(console.log).not.toHaveBeenCalled()
  expect(process.exit).not.toHaveBeenCalled()
})

it('exits and output logs when git repo is dirty', () => {
  gitStatusReturnValue = false
  checkGitStatus()
  expect(console.log).toHaveBeenCalled()
  expect(process.exit).toHaveBeenCalled()
})

it('exits and output logs when git detection fail', () => {
  gitStatusReturnValue = new Error('bum')
  checkGitStatus()
  expect(console.log).toHaveBeenCalled()
  expect(process.exit).toHaveBeenCalled()
})

it('does not exit when git repo is dirty and force flag is given', () => {
  gitStatusReturnValue = false
  checkGitStatus(true)
  expect(console.log).toHaveBeenCalledWith(
    'WARNING: Git directory is not clean. Forcibly continuing.\n'
  )
  expect(process.exit).not.toHaveBeenCalled()
})
