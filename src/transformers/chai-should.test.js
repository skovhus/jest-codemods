/* eslint-env jest */
import path from 'path';
import { defineTest } from 'jscodeshift/dist/testUtils';

console.warn = () => {};

const transformersPath = path.join(__dirname, 'transformers');

const createTest = name => {
    defineTest(transformersPath, 'chai-should', null, path.join('chai-should', name));
};

defineTest(transformersPath, 'chai-should', null, 'chai-should');

createTest('a-an');
createTest('above');
createTest('below');
createTest('eql');
createTest('equal');
createTest('exist-defined');
createTest('false');
createTest('include-contain');
createTest('instanceof');
createTest('keys');
createTest('least');
createTest('lengthof');
createTest('match');
createTest('members');
createTest('most');
createTest('nan');
createTest('null');
createTest('ok');
createTest('ownproperty');
createTest('ownpropertydescriptor');
createTest('throw');
createTest('true');
createTest('undefined');
createTest('within');
