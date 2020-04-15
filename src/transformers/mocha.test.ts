/* eslint-env jest */
import { wrapPlugin } from '../utils/test-helpers'
import plugin from './mocha'

const wrappedPlugin = wrapPlugin(plugin)

let consoleWarnings = []
beforeEach(() => {
  consoleWarnings = []
  console.warn = v => consoleWarnings.push(v)
})

function testChanged(msg, source, expectedOutput, options = {}) {
  test(msg, () => {
    const result = wrappedPlugin(source, options)
    expect(result).toBe(expectedOutput)
    expect(consoleWarnings).toEqual([])
  })
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
    test('test', () => {});
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
    test('test', () => {});
    it('it', () => {});
    test('specify', () => {})
  })
})
`
)

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
  it(() => {});

  suiteSetup('description', () => {});
  suiteTeardown('description', () => {});
  setup('description', () => {});
  teardown('description', () => {});
  test('description', () => {});
  it('description', () => {});
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
  it(() => {});

  beforeAll(() => {});
  afterAll(() => {});
  beforeEach(() => {});
  afterEach(() => {});
  test('description', () => {});
  it('description', () => {});
})
`
)

testChanged(
  'preserves exclusive tests',
  `
// @flow
suite.only('only suite', () => {
  test.only('only test', () => {});
  it.only('only test', () => {});
});
`,
  `
// @flow
describe.only('only suite', () => {
  test.only('only test', () => {});
  it.only('only test', () => {});
});
`
)

testChanged(
  'preserves skipped tests',
  `
// @flow
suite.skip('skip suite', () => {
  test.skip('skip test', () => {});
  test('test will be skipped');
  it.skip('skip test', () => {});
  it('test will be skipped');
});
`,
  `
// @flow
describe.skip('skip suite', () => {
  test.skip('skip test', () => {});
  test.skip('test will be skipped', () => {});
  it.skip('skip test', () => {});
  it.skip('test will be skipped', () => {});
});
`
)

testChanged(
  'preserves call expressions that are defined in scope',
  `
const setup = () => {};
context('test suite', () => {
    test('test', () => {
        const foo = setup();
    });
    it('test', () => {
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
    it('test', () => {
        const foo = setup();
    });
});
`
)

testChanged(
  'removes mocha import',
  `
import { describe, it } from 'mocha';
suite('suite', () => {
})
    `,
  `
describe('suite', () => {
})
    `
)

testChanged(
  'adds any type to the test context with typescript (tsx)',
  `
describe('describe', function () {
  beforeEach(function () {
    this.hello = 'hi';
  });

  context('context', () => {
    test('test', function () {
      console.log(this.hello);
    });
    it('it', function () {
      console.log(this.hello);
    });
  })
})
`,
  `
describe('describe', () => {
  let testContext: any;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    testContext.hello = 'hi';
  });

  describe('context', () => {
    test('test', () => {
      console.log(testContext.hello);
    });
    it('it', () => {
      console.log(testContext.hello);
    });
  })
})
`,
  { parser: 'tsx' }
)

testChanged(
  'adds any type to the test context with typescript (ts)',
  `
describe('describe', function () {
  beforeEach(function () {
    this.hello = 'hi';
  });

  context('context', () => {
    test('test', function () {
      console.log(this.hello);
    });
    it('it', function () {
      console.log(this.hello);
    });
  })
})
`,
  `
describe('describe', () => {
  let testContext: any;

  beforeEach(() => {
    testContext = {};
  });

  beforeEach(() => {
    testContext.hello = 'hi';
  });

  describe('context', () => {
    test('test', () => {
      console.log(testContext.hello);
    });
    it('it', () => {
      console.log(testContext.hello);
    });
  })
})
`,
  { parser: 'ts' }
)

testChanged(
  'transforms this',
  `
// @flow
describe('describe', function () {
  before(function() {
    this.hello = 'hi';
  });
  afterAll(function () {
    console.log(this.hello);
  });
  beforeEach(function () {
    this.goodbye = 'bye';
  });
  afterEach(function () {
    console.log(this.hello);
  });

  before('some text', () => {});
  after('some text', () => {});
  beforeEach('some text', () => {});
  afterEach('some text', () => {});

  context('context', () => {
    test('test', function () {
      console.log(this.hello);
      console.log(this.goodbye);
    });
    it('it', function () {
      console.log(this.hello);
      console.log(this.goodbye);
    });
    specify('specify', function () {
      console.log(this.hello);
      console.log(this.goodbye);
    })
  })
})
`,
  `
// @flow
describe('describe', () => {
  let testContext;

  beforeAll(() => {
    testContext = {};
  });

  beforeAll(() => {
    testContext.hello = 'hi';
  });
  afterAll(() => {
    console.log(testContext.hello);
  });
  beforeEach(() => {
    testContext.goodbye = 'bye';
  });
  afterEach(() => {
    console.log(testContext.hello);
  });

  beforeAll(() => {});
  afterAll(() => {});
  beforeEach(() => {});
  afterEach(() => {});

  describe('context', () => {
    test('test', () => {
      console.log(testContext.hello);
      console.log(testContext.goodbye);
    });
    it('it', () => {
      console.log(testContext.hello);
      console.log(testContext.goodbye);
    });
    test('specify', () => {
      console.log(testContext.hello);
      console.log(testContext.goodbye);
    })
  })
})
`
)
