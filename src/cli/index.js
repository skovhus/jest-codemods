#!/usr/bin/env node
import globby from 'globby';
import inquirer from 'inquirer';
import meow from 'meow';
import updateNotifier from 'update-notifier';

import checkGitStatus from './git-status';
import { executeTransformations } from './transformers';

const cli = meow(
    {
        description: 'Codemods for migrating test files to Jest.',
        help: `
    Usage
      $ jest-codemods <path> [options]

    path    Files or directory to transform. Can be a glob like src/**.test.js

    Options
      --force, -f   Bypass Git safety checks and forcibly run codemods
      --dry, -d     Dry run (no changes are made to files)
      --parser      The parser to use for parsing your source files (babel | babylon | flow)  [babel]
    `,
    },
    {
        boolean: ['force', 'dry'],
        string: ['_'],
        alias: {
            f: 'force',
            h: 'help',
            d: 'dry',
        },
    }
);

updateNotifier({ pkg: cli.pkg }).notify({ defer: false });

const TRANSFORMER_CHAI_ASSERT = 'chai-assert';
const TRANSFORMER_CHAI_SHOULD = 'chai-should';
const TRANSFORMER_TAPE = 'tape';
const TRANSFORMER_AVA = 'ava';
const TRANSFORMER_MOCHA = 'mocha';
const ALL_TRANSFORMERS = [
    TRANSFORMER_TAPE,
    TRANSFORMER_AVA,
    TRANSFORMER_MOCHA,
    TRANSFORMER_CHAI_ASSERT,
    // TRANSFORMER_CHAI_SHOULD doesn't have import detection
];

function supportFailure(supportedItems) {
    console.log(`\nCurrently, jest-codemods only has support for ${supportedItems}.`);
    console.log(
        'Feel free to create an issue on https://github.com/skovhus/jest-codemods to contribute!\n'
    );
}

if (cli.input.length) {
    // Apply all transformers if input is given using CLI.
    // TODO: consider removing this option...
    if (!cli.flags.dry) {
        checkGitStatus(cli.flags.force);
    }
    executeTransformations(cli.input, cli.flags, ALL_TRANSFORMERS);
} else {
    // Else show the fancy inquirer prompt.
    inquirer
        .prompt([
            {
                type: 'list',
                name: 'transformer',
                message: 'Which test library would you like to migrate from?',
                choices: [
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
                        name: 'Mocha',
                        value: TRANSFORMER_MOCHA,
                    },
                    {
                        name: 'Tape',
                        value: TRANSFORMER_TAPE,
                    },
                    {
                        name: 'All of the above (by detecting usage)!',
                        value: 'all',
                    },
                    {
                        name: 'Other',
                        value: 'other',
                    },
                ],
            },
            {
                type: 'list',
                name: 'mochaChai',
                message: 'Would you like to include Chai transformations with Mocha?',
                when: ({ transformer }) => TRANSFORMER_MOCHA === transformer,
                choices: [
                    {
                        name: 'Assert Syntax',
                        value: TRANSFORMER_CHAI_ASSERT,
                    },
                    {
                        name: 'Should/Expect BDD Syntax',
                        value: TRANSFORMER_CHAI_SHOULD,
                    },
                    {
                        name: 'None',
                        value: null,
                    },
                ],
            },
            {
                type: 'input',
                name: 'files',
                message: 'On which files or directory should the codemods be applied?',
                default: 'src test/**/*.js',
                filter: files => files.trim().split(/\s+/).filter(v => v),
            },
        ])
        .then(answers => {
            const { files, transformer, mochaChai } = answers;

            if (transformer === 'other') {
                return supportFailure('AVA, Tape, Chai and Mocha');
            }

            const transformers = transformer === 'all' ? ALL_TRANSFORMERS : [transformer];

            if (mochaChai) {
                transformers.push(mochaChai);
            }

            if (!files.length) {
                return undefined;
            }

            const filesExpanded = globby.sync(files);
            if (!filesExpanded.length) {
                console.log(`No files found matching ${files.join(' ')}`);
                return undefined;
            }

            if (!cli.flags.dry) {
                checkGitStatus(cli.flags.force);
            }

            return executeTransformations(filesExpanded, cli.flags, transformers);
        });
}
