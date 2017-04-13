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
const TRANSFORMER_TAPE = 'tape';
const TRANSFORMER_AVA = 'ava';
const TRANSFORMER_MOCHA = 'mocha';
const allTransformers = [TRANSFORMER_TAPE, TRANSFORMER_AVA, TRANSFORMER_MOCHA];

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
    executeTransformations(cli.input, cli.flags, [
        ...allTransformers,
        TRANSFORMER_CHAI_ASSERT,
    ]);
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
                        name: 'Tape',
                        value: TRANSFORMER_TAPE,
                    },
                    {
                        name: 'AVA',
                        value: TRANSFORMER_AVA,
                    },
                    {
                        name: 'Mocha',
                        value: TRANSFORMER_MOCHA,
                    },
                    {
                        name: 'All of the above!',
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
                name: 'chai',
                message: 'Would you like to include Chai transformations with Mocha?',
                when: ({ transformer }) =>
                    [TRANSFORMER_MOCHA, 'all'].indexOf(transformer) > -1,
                choices: [
                    {
                        name: 'Assert Syntax',
                        value: TRANSFORMER_CHAI_ASSERT,
                    },
                    {
                        name: 'Other',
                        value: 'other',
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
            const { files, transformer, chai } = answers;

            if (transformer === 'other') {
                return supportFailure('AVA, Tape, and Mocha');
            }

            const transformers = transformer === 'all' ? allTransformers : [transformer];

            if (chai) {
                if (chai !== TRANSFORMER_CHAI_ASSERT) {
                    return supportFailure('Chai Assert syntax');
                }
                transformers.push(chai);
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
