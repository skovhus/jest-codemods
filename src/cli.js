#!/usr/bin/env node
import path from 'path';

import execa from 'execa';
import isGitClean from 'is-git-clean';
import meow from 'meow';
import updateNotifier from 'update-notifier';

const PATH_TRANSFORMER = path.join(__dirname, 'transformers', 'tape.js');

function checkGitStatus(force) {
    let clean = false;
    let errorMessage = 'Unable to determine if git directory is clean';
    try {
        clean = isGitClean.sync();
        errorMessage = 'Git directory is not clean';
    } catch (err) {
        // Ignoring error
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

function executeTransformation(files, flags) {
    const spawnOptions = {
        stdio: 'inherit',
        stripEof: false,
    };

    const args = ['-t', PATH_TRANSFORMER].concat(files);
    if (flags.dry) {
        args.push('--dry');
    }
    if (['babel', 'babylon', 'flow'].indexOf(flags.parser) >= 0) {
        args.push('--parser', flags.parser);
    }

    console.log(`Executing command: jscodeshift ${args.join(' ')}`);

    const result = execa.sync('jscodeshift', args, spawnOptions);
    if (result.error) {
        throw result.error;
    }
}

const cli = meow(
    {
        description: 'Codemod that simplify migrating to Jest.',
        help: `
    Usage
      $ jest-codemods <path> [options]

    path    Files or directory to transform. Can be a glob like src/**.test.js

    Only files with Tape will be converted.

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

updateNotifier({ pkg: cli.pkg }).notify();

const files = cli.input;
if (files.length === 0) {
    cli.showHelp();
} else {
    if (!cli.flags.dry) {
        checkGitStatus(cli.flags.force);
    }
    executeTransformation(files, cli.flags);
}
