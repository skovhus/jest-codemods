/* eslint-env jest */

let execaReturnValue;
jest.setMock('execa', {
    sync: () => execaReturnValue,
});

const fs = require('fs');
const path = require('path');
const {
    executeTransformations,
    jscodeshiftExecutable,
    transformerDirectory,
} = require('./transformers');

it('finds transformer directory', () => {
    fs.lstatSync(transformerDirectory);
});

it('finds jscodeshift executable', () => {
    fs.lstatSync(jscodeshiftExecutable);
});

it('runs jscodeshift for the given transformer', () => {
    execaReturnValue = { error: null };
    console.log = jest.fn();
    executeTransformations('src', {}, ['tape']);
    expect(console.log).toBeCalledWith(
        `Executing command: jscodeshift -t ${path.join(transformerDirectory, 'tape.js')} src`
    );
});

it('supports jscodeshift flags', () => {
    execaReturnValue = { error: null };
    console.log = jest.fn();
    executeTransformations('folder', { dry: true, parser: 'flow' }, ['ava']);
    expect(console.log).toBeCalledWith(
        `Executing command: jscodeshift -t ${path.join(transformerDirectory, 'ava.js')} folder --dry --parser flow`
    );
});

it('supports jscodeshift custom arguments', () => {
    execaReturnValue = { error: null };
    console.log = jest.fn();
    executeTransformations('folder', { dry: true, parser: 'flow' }, ['ava'], ['--standaloneMode']);
    expect(console.log).toBeCalledWith(
        `Executing command: jscodeshift -t ${path.join(transformerDirectory, 'ava.js')} folder --dry --parser flow --standaloneMode`
    );
});

it('rethrows jscodeshift errors', () => {
    const transformerError = new Error('bum');
    execaReturnValue = { error: transformerError };
    console.log = jest.fn();
    expect(() => {
        executeTransformations('src', {}, ['tape']);
    }).toThrowError(transformerError);
});
