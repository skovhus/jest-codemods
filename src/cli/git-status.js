import isGitClean from 'is-git-clean';

export default function checkGitStatus(force) {
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

    if (!clean) {
        if (force) {
            console.log(`WARNING: ${errorMessage}. Forcibly continuing.`);
        } else {
            console.log(
                `ERROR: ${errorMessage}. Refusing to continue.`,
                'Ensure you have a backup of your tests or commit the latest changes before continuing.',
                'You may use the --force flag to override this safety check.'
            );
            process.exit(1);
        }
    }
}
