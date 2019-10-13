/* eslint-env jest */

let gitStatusReturnValue: boolean | Error = false;
jest.setMock('is-git-clean', {
    sync: () => {
        if (typeof gitStatusReturnValue === 'boolean') {
            return gitStatusReturnValue;
        }
        throw gitStatusReturnValue;
    },
});

const checkGitStatus = require('./git-status').default;

const _process: any = process;

it('does not exit and output any logs when git repo is clean', () => {
    gitStatusReturnValue = true;
    console.log = jest.fn();
    _process.exit = jest.fn();
    checkGitStatus();
    expect(console.log).not.toHaveBeenCalled();
    expect(_process.exit).not.toHaveBeenCalled();
});

it('does not exit and output any logs when not a git repo', () => {
    const err = new Error() as any;
    err.stderr = 'Not a git repository';
    gitStatusReturnValue = err;
    console.log = jest.fn();
    _process.exit = jest.fn();
    checkGitStatus();
    expect(console.log).not.toHaveBeenCalled();
    expect(_process.exit).not.toHaveBeenCalled();
});

it('exits and output logs when git repo is dirty', () => {
    gitStatusReturnValue = false;
    console.log = jest.fn();
    _process.exit = jest.fn();
    checkGitStatus();
    expect(console.log).toHaveBeenCalled();
    expect(_process.exit).toHaveBeenCalled();
});

it('exits and output logs when git detection fail', () => {
    gitStatusReturnValue = new Error('bum');
    console.log = jest.fn();
    _process.exit = jest.fn();
    checkGitStatus();
    expect(console.log).toHaveBeenCalled();
    expect(_process.exit).toHaveBeenCalled();
});

it('does not exit when git repo is dirty and force flag is given', () => {
    gitStatusReturnValue = false;
    console.log = jest.fn();
    _process.exit = jest.fn();
    checkGitStatus(true);
    expect(console.log).toHaveBeenCalledWith(
        'WARNING: Git directory is not clean. Forcibly continuing.\n'
    );
    expect(_process.exit).not.toHaveBeenCalled();
});
