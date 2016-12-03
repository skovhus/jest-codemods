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

    Only files using Tape or AVA will be converted.

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

const allTransformers = ['tape', 'ava', 'mocha'];

function supportFailure(supportedItems) {
    console.log(`\nCurrently, jest-codemods only has support for ${supportedItems}.`);
    console.log('Feel free to create an issue on https://github.com/skovhus/jest-codemods to contribute!\n');
}

if (cli.input.length) {
    // Apply all transformers if input is given using CLI.
    if (!cli.flags.dry) {
        checkGitStatus(cli.flags.force);
    }
    executeTransformations(cli.input, cli.flags, [...allTransformers, 'chai-assert']);
} else {
    // Else show the fancy inquirer prompt.
    inquirer.prompt([{
        type: 'list',
        name: 'transformer',
        message: 'Which test library would you like to migrate from?',
        choices: [{
            name: 'Tape',
            value: 'tape',
        }, {
            name: 'AVA',
            value: 'ava',
        }, {
            name: 'Mocha',
            value: 'mocha',
        }, {
            name: 'All of the above!',
            value: 'all',
        }, {
            name: 'Other',
            value: 'other',
        }],
    }, {
        type: 'list',
        name: 'chai',
        message: 'Whould you like to include Chai transformations with Mocha?',
        when: ({ transformer }) => ['mocha', 'all'].indexOf(transformer) > -1,
        choices: [{
            name: 'Assert Syntax',
            value: 'chai-assert',
        }, {
            name: 'Other',
            value: 'other',
        }, {
            name: 'None',
            value: null,
        }],
    }, {
        type: 'input',
        name: 'files',
        message: 'On which files or directory should the codemods be applied?',
        default: 'src test/**/*.js',
        filter: files => files.trim().split(/\s+/).filter(v => v),
    }]).then(answers => {
        const { files, transformer, chai } = answers;

        if (transformer === 'other') {
            return supportFailure('Ava, Tape, and Mocha');
        }

        const transformers = transformer === 'all' ? allTransformers : [transformer];

        if (chai) {
            if (chai !== 'assert') {
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
