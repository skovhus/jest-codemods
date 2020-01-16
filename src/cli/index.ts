#!/usr/bin/env node

import chalk from 'chalk'
import globby from 'globby'
import inquirer from 'inquirer'
import meow from 'meow'
import updateNotifier from 'update-notifier'

import checkGitStatus from './git-status'
import { executeTransformations, Parser } from './transformers'

const cli = meow(
  `
Usage:      npx jest-codemods <path> [options]

Examples:   npx jest-codemods src
            npx jest-codemods src/**/*.test.js
            npx jest-codemods src/**/*.test.js --parser=babel

Options:
  -f, --force             Bypass Git safety checks and force codemods to run
  -d, --dry               Dry run (no changes are made to files)
  --parser                The parser to use (babel, flow, ts, tsx)
  --transformer           The transformer to use (ava, chai-assert, chai-should, expect-js, expect, jasmine-globals, jasmine-this, mocha, should, tape)
  --skipImportDetection   Keep using the global object for assertions
  --standaloneMode        Use explicit require calls instead of globals
  --mochaAssertion        Use assertion transformations with Mocha (chai-assert, chai-should, expect-js, expect, should)`,
  {
    boolean: ['force', 'dry'],
    string: ['_'],
    alias: {
      f: 'force',
      h: 'help',
      d: 'dry',
    },
  },
  {
    flags: {
      force: {
        type: 'boolean',
        alias: 'f',
      },
      dry: {
        type: 'boolean',
        alias: 'd',
      },
      parser: {
        type: 'string',
      },
      transformer: {
        type: 'string',
      },
      skipImportDetection: {
        type: 'boolean',
      },
      standaloneMode: {
        type: 'boolean',
      },
      mochaAssertion: {
        type: 'string',
      },
    },
  }
)

updateNotifier({ pkg: cli.pkg }).notify({ defer: false })

if (!cli.flags.dry) {
  checkGitStatus(cli.flags.force)
}

const TRANSFORMER_AVA = 'ava'
const TRANSFORMER_CHAI_ASSERT = 'chai-assert'
const TRANSFORMER_CHAI_SHOULD = 'chai-should'
const TRANSFORMER_EXPECT_JS = 'expect-js'
const TRANSFORMER_EXPECT_1 = 'expect'
const TRANSFORMER_JASMINE_GLOBALS = 'jasmine-globals'
const TRANSFORMER_JASMINE_THIS = 'jasmine-this'
const TRANSFORMER_MOCHA = 'mocha'
const TRANSFORMER_SHOULD = 'should'
const TRANSFORMER_TAPE = 'tape'

const ALL_TRANSFORMERS = [
  // TRANSFORMER_CHAI_SHOULD & TRANSFORMER_SHOULD doesn't have import detection
  TRANSFORMER_AVA,
  TRANSFORMER_CHAI_ASSERT,
  TRANSFORMER_EXPECT_JS,
  TRANSFORMER_EXPECT_1,
  TRANSFORMER_MOCHA,
  TRANSFORMER_TAPE,
  TRANSFORMER_JASMINE_THIS,
]

const TRANSFORMER_INQUIRER_CHOICES = [
  {
    name: 'AVA',
    value: TRANSFORMER_AVA,
  },
  {
    name: 'Chai: Assert Syntax',
    value: TRANSFORMER_CHAI_ASSERT,
  },
  {
    name: 'Chai: Should/Expect BDD Syntax',
    value: TRANSFORMER_CHAI_SHOULD,
  },
  {
    name: 'Expect.js (by Automattic)',
    value: TRANSFORMER_EXPECT_JS,
  },
  {
    name: 'Expect@1.x (by mjackson)',
    value: TRANSFORMER_EXPECT_1,
  },
  {
    name: 'Jasmine: globals',
    value: TRANSFORMER_JASMINE_GLOBALS,
  },
  {
    name: 'Jasmine: this usage',
    value: TRANSFORMER_JASMINE_THIS,
  },
  {
    name: 'Mocha',
    value: TRANSFORMER_MOCHA,
  },
  {
    name: 'Should.js',
    value: TRANSFORMER_SHOULD,
  },
  {
    name: 'Tape',
    value: TRANSFORMER_TAPE,
  },
  {
    name: 'All of the above (use with care)!',
    value: 'all',
  },
  {
    name: 'Other',
    value: 'other',
  },
]

const PARSER_INQUIRER_CHOICES: { name: string; value: Parser }[] = [
  {
    name: 'Babel',
    value: 'babel',
  },
  {
    name: 'Flow',
    value: 'flow',
  },
  {
    name: 'TypeScript',
    value: 'ts',
  },
  {
    name: 'TypeScript & TSX',
    value: 'tsx',
  },
]

const MOCHA_ASSERTION_INQUIRER_CHOICES = [
  {
    name: 'Chai: Assert Syntax',
    value: TRANSFORMER_CHAI_ASSERT,
  },
  {
    name: 'Chai: Should/Expect BDD Syntax',
    value: TRANSFORMER_CHAI_SHOULD,
  },
  {
    name: 'Expect.js (by Automattic)',
    value: TRANSFORMER_EXPECT_JS,
  },
  {
    name: 'Expect@1.x (by mjackson)',
    value: TRANSFORMER_EXPECT_1,
  },
  {
    name: 'Should.js',
    value: TRANSFORMER_SHOULD,
  },
  {
    name: 'None',
    value: null,
  },
]

function supportFailure(supportedItems) {
  console.log(`\nCurrently, jest-codemods only has support for ${supportedItems}.`)
  console.log(
    'Feel free to create an issue on https://github.com/skovhus/jest-codemods to contribute!\n'
  )
}

function expandFilePathsIfNeeded(filesBeforeExpansion) {
  const shouldExpandFiles = filesBeforeExpansion.some(file => file.includes('*'))
  return shouldExpandFiles ? globby.sync(filesBeforeExpansion) : filesBeforeExpansion
}

const isValidParser = PARSER_INQUIRER_CHOICES.map(c => c.value).includes(cli.flags.parser)

const isValidTransformer = TRANSFORMER_INQUIRER_CHOICES.map(c => c.value).includes(
  cli.flags.transformer
)

const isValidMochaAssertion = MOCHA_ASSERTION_INQUIRER_CHOICES.map(c => c.value).includes(
  cli.flags.mochaAssertion
)

inquirer
  .prompt([
    {
      type: 'list',
      name: 'parser',
      message: 'Which parser do you want to use?',
      when: () => !isValidParser,
      pageSize: PARSER_INQUIRER_CHOICES.length,
      choices: PARSER_INQUIRER_CHOICES,
    },
    {
      type: 'list',
      name: 'transformer',
      message: 'Which test library would you like to migrate from?',
      when: () => !isValidTransformer,
      pageSize: TRANSFORMER_INQUIRER_CHOICES.length,
      choices: TRANSFORMER_INQUIRER_CHOICES,
    },
    {
      name: 'skipImportDetection',
      type: 'list',
      message:
        'Are you using the global object for assertions (i.e. without requiring them)',
      when: () => cli.flags.skipImportDetection === undefined,
      choices: [
        {
          name: `No, I use import/require statements for my current assertion library`,
          value: false,
        },
        {
          name: `Yes, and I'm not afraid of false positive transformations`,
          value: true,
        },
      ],
    },
    {
      name: 'standaloneMode',
      type: 'list',
      message: 'Will you be using Jest on Node.js as your test runner?',
      when: () => cli.flags.standaloneMode === undefined,
      choices: [
        {
          name: 'Yes, use the globals provided by Jest (recommended)',
          value: false,
        },
        {
          name: 'No, use explicit require() calls instead of globals',
          value: true,
        },
      ],
    },
    {
      type: 'list',
      name: 'mochaAssertion',
      message: 'Would you like to include assertion transformations with Mocha?',
      when: ({ transformer }) =>
        TRANSFORMER_MOCHA === transformer && !isValidMochaAssertion,
      choices: MOCHA_ASSERTION_INQUIRER_CHOICES,
    },
    {
      type: 'input',
      name: 'files',
      message: 'On which files or directory should the codemods be applied?',
      when: () => !cli.input.length,
      default: '.',
      filter: files =>
        files
          .trim()
          .split(/\s+/)
          .filter(v => v),
    },
  ])
  .then(answers => {
    const {
      files,
      transformer,
      parser,
      mochaAssertion,
      skipImportDetection,
      standaloneMode,
    } = Object.assign({}, cli.flags, answers)
    if (transformer === 'other') {
      return supportFailure('AVA, Chai, Expect.js, Expect@1.x, Mocha, Should.js and Tape')
    }

    const transformers = transformer === 'all' ? ALL_TRANSFORMERS : [transformer]

    if (mochaAssertion) {
      transformers.push(mochaAssertion)
    }

    const filesBeforeExpansion = cli.input.length ? cli.input : files
    const filesExpanded = expandFilePathsIfNeeded(filesBeforeExpansion)

    if (!filesExpanded.length) {
      console.log(`No files found matching ${filesBeforeExpansion.join(' ')}`)
      return
    }

    const transformerArgs = []
    if (standaloneMode) {
      transformerArgs.push('--standaloneMode=true')
      console.log(
        chalk.yellow('\nNOTICE: You need to manually install expect@21+ and jest-mock')
      )
    }

    if (skipImportDetection) {
      transformerArgs.push('--skipImportDetection=true')
      console.log(
        chalk.yellow('\nNOTICE: Skipping import detection, you might get false positives')
      )
    }

    return executeTransformations({
      files: filesExpanded,
      flags: cli.flags,
      parser,
      transformers,
      transformerArgs,
    })
  })
