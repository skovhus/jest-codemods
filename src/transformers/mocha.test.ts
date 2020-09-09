/* eslint-env jest */
import { wrapPlugin } from '../utils/test-helpers'
import plugin from './mocha'

const wrappedPlugin = wrapPlugin(plugin)

let consoleWarnings = []
beforeEach(() => {
  consoleWarnings = []
  console.warn = (v) => consoleWarnings.push(v)
})

function assertTransformation(source, expectedOutput, options = {}) {
  const result = wrappedPlugin(source, options)
  expect(result).toBe(expectedOutput)
  expect(consoleWarnings).toEqual([])
}

test('maps BDD-style interface', () => {
  assertTransformation(
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
})

test('maps TDD-style interface', () => {
  assertTransformation(
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
})

test('preserves exclusive tests', () => {
  assertTransformation(
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
})

test('preserves skipped tests', () => {
  assertTransformation(
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
})

test('preserves call expressions that are defined in scope', () => {
  assertTransformation(
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
})

test('removes mocha import', () => {
  assertTransformation(
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
})

test('adds any type to the test context with typescript (tsx)', () => {
  assertTransformation(
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
})

test('adds any type to the test context with typescript (ts)', () => {
  assertTransformation(
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
})

test('transforms this', () => {
  assertTransformation(
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
})
