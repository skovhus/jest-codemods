/* eslint-env jest */
import { wrapPlugin } from '../utils/test-helpers';
import plugin from './mocha';

const wrappedPlugin = wrapPlugin(plugin);

let consoleWarnings = [];
beforeEach(() => {
    consoleWarnings = [];
    console.warn = v => consoleWarnings.push(v);
});

function testChanged(msg, source, expectedOutput) {
    test(msg, () => {
        const result = wrappedPlugin(source);
        expect(result).toBe(expectedOutput);
        expect(consoleWarnings).toEqual([]);
    });
}

testChanged(
    'maps BDD-style interface',
    `
// @flow
describe('describe', () => {
  before(() => {});
  after(() => {});
  beforeEach(() => {});
  afterEach(() => {});

  before('some text', () => {});
  after('some text', () => {});
  beforeEach('some text', () => {});
  afterEach('some text', () => {});

  context('context', () => {
    it('it', () => {});
    specify('specify', () => {})
  })
})
`,
    `
// @flow
describe('describe', () => {
  beforeAll(() => {});
  afterAll(() => {});
  beforeEach(() => {});
  afterEach(() => {});

  beforeAll(() => {});
  afterAll(() => {});
  beforeEach(() => {});
  afterEach(() => {});

  describe('context', () => {
    test('it', () => {});
    test('specify', () => {})
  })
})
`
);

testChanged(
    'maps TDD-style interface',
    `
// @flow
suite('suite', () => {
  suiteSetup(() => {});
  suiteTeardown(() => {});
  setup(() => {});
  teardown(() => {});
  test(() => {});

  suiteSetup('description', () => {});
  suiteTeardown('description', () => {});
  setup('description', () => {});
  teardown('description', () => {});
  test('description', () => {});
})
`,
    `
// @flow
describe('suite', () => {
  beforeAll(() => {});
  afterAll(() => {});
  beforeEach(() => {});
  afterEach(() => {});
  test(() => {});

  beforeAll(() => {});
  afterAll(() => {});
  beforeEach(() => {});
  afterEach(() => {});
  test('description', () => {});
})
`
);

testChanged(
    'preserves exclusive tests',
    `
// @flow
suite.only('only suite', () => {
  test.only('only test', () => {});
});
`,
    `
// @flow
describe.only('only suite', () => {
  test.only('only test', () => {});
});
`
);

testChanged(
    'preserves skipped tests',
    `
// @flow
suite.skip('skip suite', () => {
  test.skip('skip test', () => {});
  test('test will be skipped');
});
`,
    `
// @flow
describe.skip('skip suite', () => {
  test.skip('skip test', () => {});
  test('test will be skipped');
});
`
);

testChanged(
    'preserves call expressions that are defined in scope',
    `
const setup = () => {};
context('test suite', () => {
    test('test', () => {
        const foo = setup();
    });
});
`,
    `
const setup = () => {};
describe('test suite', () => {
    test('test', () => {
        const foo = setup();
    });
});
`
);
