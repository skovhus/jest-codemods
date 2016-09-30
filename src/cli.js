#!/usr/bin/env node
import path from 'path';

import execa from 'execa';
import globby from 'globby';
import inquirer from 'inquirer';
import isGitClean from 'is-git-clean';
import meow from 'meow';
import updateNotifier from 'update-notifier';

function checkGitStatus(force) {
    let clean = false;
    let errorMessage = 'Unable to determine if git directory is clean';
    try {
        clean = isGitClean.sync(process.cwd());
        errorMessage = 'Git directory is not clean';
    } catch (err) {
        if (err && err.stderr && err.stderr.indexOf('Not a git repository') >= 0) {
            clean = true;
        }
    }

    const ENSURE_BACKUP_MESSAGE = 'Ensure you have a backup of your tests or commit the latest changes before continuing.';

    if (!clean) {
        if (force) {
            console.log(`WARNING: ${errorMessage}. Forcibly continuing.`, ENSURE_BACKUP_MESSAGE);
        } else {
            console.log(
                `ERROR: ${errorMessage}. Refusing to continue.`,
                ENSURE_BACKUP_MESSAGE,
                'You may use the --force flag to override this safety check.'
            );
            process.exit(1);
        }
    }
}

function executeTransformation(files, flags, transformer) {
    const transformerPath = path.join(__dirname, 'transformers', `${transformer}.js`);

    const args = ['-t', transformerPath].concat(files);
    if (flags.dry) {
        args.push('--dry');
    }
    if (['babel', 'babylon', 'flow'].indexOf(flags.parser) >= 0) {
        args.push('--parser', flags.parser);
    }

    console.log(`Executing command: jscodeshift ${args.join(' ')}`);

    const result = execa.sync(require.resolve('.bin/jscodeshift'), args, {
        stdio: 'inherit',
        stripEof: false,
    });

    if (result.error) {
        throw result.error;
    }
}

function executeTransformations(files, flags, transformers) {
    transformers.forEach(t => {
        executeTransformation(files, flags, t);
    });
}

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

if (cli.input.length) {
    // Apply all transformers if input is given using CLI.
    if (!cli.flags.dry) {
        checkGitStatus(cli.flags.force);
    }
    executeTransformations(cli.input, cli.flags, ['tape', 'ava']);
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
            name: 'All of the above!',
            value: 'all',
        }, {
            name: 'Other',
            value: 'other',
        }],
    }, {
        type: 'input',
        name: 'files',
        message: 'On which files or directory should the codemods be applied?',
        default: 'src test/**/*.js',
        filter: files => files.trim().split(/\s+/).filter(v => v),
    }]).then(answers => {
        const { files, transformer } = answers;

        if (transformer === 'other') {
            console.log('\nCurrently jest-codemods only have support for AVA and Tape.');
            console.log('Feel free to create an issue on https://github.com/skovhus/jest-codemods or help contribute!\n');
            return;
        }

        if (!files.length) {
            return;
        }

        const filesExpanded = globby.sync(files);
        if (!filesExpanded.length) {
            console.log(`No files found matching ${files.join(' ')}`);
            return;
        }

        if (!cli.flags.dry) {
            checkGitStatus(cli.flags.force);
        }

        const transformers = transformer === 'all' ? ['tape', 'ava'] : [transformer];
        transformers.forEach(t => {
            executeTransformation(filesExpanded, cli.flags, t);
        });
    });
}
