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
    executeTransformations({
        files: 'src',
        flags: {},
        parser: 'flow',
        transformers: ['tape'],
    });
    expect(console.log).toBeCalledWith(
        `Executing command: jscodeshift -t ${path.join(
            transformerDirectory,
            'tape.js'
        )} src --ignore-pattern node_modules --parser flow`
    );
});

it('supports jscodeshift flags', () => {
    execaReturnValue = { error: null };
    console.log = jest.fn();
    executeTransformations({
        files: 'folder',
        flags: { dry: true },
        parser: 'flow',
        transformers: ['ava'],
    });
    expect(console.log).toBeCalledWith(
        `Executing command: jscodeshift -t ${path.join(
            transformerDirectory,
            'ava.js'
        )} folder --dry --ignore-pattern node_modules --parser flow`
    );
});

it('supports typescript parser', () => {
    execaReturnValue = { error: null };
    console.log = jest.fn();
    executeTransformations({
        files: 'folder',
        flags: { dry: true },
        parser: 'tsx',
        transformers: ['ava'],
    });
    expect(console.log).toBeCalledWith(
        `Executing command: jscodeshift -t ${path.join(
            transformerDirectory,
            'ava.js'
        )} folder --dry --ignore-pattern node_modules --parser tsx --extensions=tsx,ts`
    );
});

it('supports jscodeshift custom arguments', () => {
    execaReturnValue = { error: null };
    console.log = jest.fn();
    executeTransformations({
        files: 'folder',
        flags: { dry: true },
        parser: 'babel',
        transformers: ['ava'],
        transformerArgs: ['--standaloneMode'],
    });
    expect(console.log).toBeCalledWith(
        `Executing command: jscodeshift -t ${path.join(
            transformerDirectory,
            'ava.js'
        )} folder --dry --ignore-pattern node_modules --parser babel --standaloneMode`
    );
});

it('rethrows jscodeshift errors', () => {
    const transformerError = new Error('bum');
    execaReturnValue = { error: transformerError };
    console.log = jest.fn();
    expect(() => {
        executeTransformations({
            files: 'src',
            flags: {},
            parser: 'flow',
            transformers: ['tape'],
        });
    }).toThrowError(transformerError);
});
