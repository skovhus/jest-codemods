/* eslint-env jest */

let gitStatusReturnValue;
jest.setMock('is-git-clean', {
    sync: () => {
        if (typeof gitStatusReturnValue === 'boolean') {
            return gitStatusReturnValue;
        }
        throw gitStatusReturnValue;
    },
});

const checkGitStatus = require('./git-status').default;

it('does not exit and output any logs when git repo is clean', () => {
    gitStatusReturnValue = true;
    console.log = jest.fn();
    process.exit = jest.fn();
    checkGitStatus();
    expect(console.log).not.toBeCalled();
    expect(process.exit).not.toBeCalled();
});

it('does not exit and output any logs when not a git repo', () => {
    const err = new Error();
    err.stderr = 'Not a git repository';
    gitStatusReturnValue = err;
    console.log = jest.fn();
    process.exit = jest.fn();
    checkGitStatus();
    expect(console.log).not.toBeCalled();
    expect(process.exit).not.toBeCalled();
});

it('exits and output logs when git repo is dirty', () => {
    gitStatusReturnValue = false;
    console.log = jest.fn();
    process.exit = jest.fn();
    checkGitStatus();
    expect(console.log).toBeCalled();
    expect(process.exit).toBeCalled();
});

it('exits and output logs when git detection fail', () => {
    gitStatusReturnValue = new Error('bum');
    console.log = jest.fn();
    process.exit = jest.fn();
    checkGitStatus();
    expect(console.log).toBeCalled();
    expect(process.exit).toBeCalled();
});

it('does not exit when git repo is dirty and force flag is given', () => {
    gitStatusReturnValue = false;
    console.log = jest.fn();
    process.exit = jest.fn();
    checkGitStatus(true);
    expect(console.log).toBeCalledWith(
        'WARNING: Git directory is not clean. Forcibly continuing.\n'
    );
    expect(process.exit).not.toBeCalled();
});
