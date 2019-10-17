/* eslint-env jest */
import chalk from 'chalk'

import { wrapPlugin } from '../utils/test-helpers'
import plugin from './jasmine-this'

chalk.enabled = false
const wrappedPlugin = wrapPlugin(plugin)

function testChanged(msg, source, expectedOutput, options = {}) {
  test(msg, () => {
    const result = wrappedPlugin(source, options)
    expect(result).toBe(expectedOutput)
  })
}

testChanged(
  'transforms simple cases',
  `
describe('foo', function() {
    beforeEach(function() {
        this.foo = { id: 'FOO' };
        this.bar = { id: 'BAR', child: this.foo };
    });

    it('should have proper IDs', function() {
        expect(this.foo.id).to.equal('FOO');
        expect(this.bar.id).to.equal('BAR');
        expect(this.bar.child.id).to.equal('FOO');
    });
});
`,
  `
describe('foo', () => {
    let testContext;

    beforeEach(() => {
        testContext = {};
    });

    beforeEach(() => {
        testContext.foo = { id: 'FOO' };
        testContext.bar = { id: 'BAR', child: testContext.foo };
    });

    it('should have proper IDs', () => {
        expect(testContext.foo.id).to.equal('FOO');
        expect(testContext.bar.id).to.equal('BAR');
        expect(testContext.bar.child.id).to.equal('FOO');
    });
});
`
)

testChanged(
  'does not transform generator functions',
  `
describe('foo', function*() {
    beforeEach(function*() {
        this.foo = { id: 'FOO' };
        this.bar = { id: 'BAR', child: this.foo };
    });

    it('should have proper IDs', function*() {
        expect(this.foo.id).to.equal('FOO');
        expect(this.bar.id).to.equal('BAR');
        expect(this.bar.child.id).to.equal('FOO');
    });
});
`,
  `
describe('foo', function*() {
    let testContext;

    beforeEach(() => {
        testContext = {};
    });

    beforeEach(function*() {
        testContext.foo = { id: 'FOO' };
        testContext.bar = { id: 'BAR', child: testContext.foo };
    });

    it('should have proper IDs', function*() {
        expect(testContext.foo.id).to.equal('FOO');
        expect(testContext.bar.id).to.equal('BAR');
        expect(testContext.bar.child.id).to.equal('FOO');
    });
});
`
)

testChanged(
  'transforms only test functions context',
  `
describe('foo', function() {
    const MockClass = function(options) {
        this.options = options;
        this.stop = sinon.spy();
    };

    MockClass.prototype.run = function() {
      return this.options.path;
    }

    beforeEach(function() {
        this.path = '/foo';
        this.mocked = new MockClass({
            limit: 123,
        });
    });

    afterEach(function() {
        this.mocked.stop();
    });

    it('should run with context data', function() {
        this.mocked.run({ path: this.path });
    });
});

describe('bar', function () {
  describe('ham', function () {
    const View = Marionette.ItemView.extend({
      initialize: function (options) {
        this.selected = options.selected;
      }
    });
  });
});
`,
  `
describe('foo', () => {
    let testContext;

    beforeEach(() => {
        testContext = {};
    });

    const MockClass = function(options) {
        this.options = options;
        this.stop = sinon.spy();
    };

    MockClass.prototype.run = function() {
      return this.options.path;
    }

    beforeEach(() => {
        testContext.path = '/foo';
        testContext.mocked = new MockClass({
            limit: 123,
        });
    });

    afterEach(() => {
        testContext.mocked.stop();
    });

    it('should run with context data', () => {
        testContext.mocked.run({ path: testContext.path });
    });
});

describe('bar', () => {
  describe('ham', () => {
    const View = Marionette.ItemView.extend({
      initialize: function (options) {
        this.selected = options.selected;
      }
    });
  });
});
`
)

testChanged(
  'transforms nested describes',
  `
describe('foo', function() {
    beforeEach(function() {
        this.foo = { id: 'FOO' };
        this.bar = { id: 'BAR' };
    });

    describe('inner foo', function() {
        beforeEach(function() {
            this.foo = { id: 'OOF' };
            this.ham = { id: 'HAM' };
        });

        it('should have proper IDs', function() {
            const foo = this.foo;
            expect(foo.id).to.equal('OOF');
            expect(this.bar.id).to.equal('BAR');
            expect(this.ham.id).to.equal('HAM');
        });
    });
});
`,
  `
describe('foo', () => {
    let testContext;

    beforeEach(() => {
        testContext = {};
    });

    beforeEach(() => {
        testContext.foo = { id: 'FOO' };
        testContext.bar = { id: 'BAR' };
    });

    describe('inner foo', () => {
        beforeEach(() => {
            testContext.foo = { id: 'OOF' };
            testContext.ham = { id: 'HAM' };
        });

        it('should have proper IDs', () => {
            const foo = testContext.foo;
            expect(foo.id).to.equal('OOF');
            expect(testContext.bar.id).to.equal('BAR');
            expect(testContext.ham.id).to.equal('HAM');
        });
    });
});
`
)

testChanged(
  'transforms plain functions within lifecycle methods',
  `
describe('foo', function() {
    beforeEach(function() {
        this.foo = { id: 'FOO' };
        this.action = function() {
            return this.foo;
        };
        this.instance = {
          action: function() {
            this.bar = 123;
          },
          other: sinon.spy(function() {
            this.bar = 456;
          }),
        };
    });

    test('should have proper IDs', function() {
        class Container extends Component {
            constructor() {
                super();
                this.state = 123;
            }
        }
        expect(this.foo.id).to.equal('FOO');
        expect(this.action().id).to.equal('FOO');
        this.instance.action();
        this.instance.other();
    });
});
`,
  `
describe('foo', () => {
    let testContext;

    beforeEach(() => {
        testContext = {};
    });

    beforeEach(() => {
        testContext.foo = { id: 'FOO' };
        testContext.action = function() {
            return testContext.foo;
        };
        testContext.instance = {
          action: function() {
            this.bar = 123;
          },
          other: sinon.spy(function() {
            this.bar = 456;
          }),
        };
    });

    test('should have proper IDs', () => {
        class Container extends Component {
            constructor() {
                super();
                this.state = 123;
            }
        }
        expect(testContext.foo.id).to.equal('FOO');
        expect(testContext.action().id).to.equal('FOO');
        testContext.instance.action();
        testContext.instance.other();
    });
});
`
)

testChanged(
  'transforms context within arrow functions',
  `
describe('foo', () => {
    beforeEach(function() {
        this.foo = { id: 'FOO' };
    });

    it('should have proper IDs', function() {
        expect(this.foo.id).to.equal('FOO');
    });
});
`,
  `
describe('foo', () => {
    let testContext;

    beforeEach(() => {
        testContext = {};
    });

    beforeEach(() => {
        testContext.foo = { id: 'FOO' };
    });

    it('should have proper IDs', () => {
        expect(testContext.foo.id).to.equal('FOO');
    });
});
`
)

testChanged(
  'transforms context within async functions',
  `
describe('foo', function () {
    beforeEach(async function() {
        this.foo = await globalPromise();
    });

    it('should have proper IDs', async function() {
        await otherPromise();
        expect(this.foo).to.equal('FOO');
    });
});
`,
  `
describe('foo', () => {
    let testContext;

    beforeEach(() => {
        testContext = {};
    });

    beforeEach(async () => {
        testContext.foo = await globalPromise();
    });

    it('should have proper IDs', async () => {
        await otherPromise();
        expect(testContext.foo).to.equal('FOO');
    });
});
`
)

testChanged(
  'original issue example',
  `
beforeEach(function () {
    this.hello = 'hi';
});

afterEach(function () {
    console.log(this.hello);
});

describe('context', () => {
    it('should work', function () {
        console.log(this.hello);
    });
});
`,
  `
let testContext;

beforeEach(() => {
    testContext = {};
});

beforeEach(() => {
    testContext.hello = 'hi';
});

afterEach(() => {
    console.log(testContext.hello);
});

describe('context', () => {
    it('should work', () => {
        console.log(testContext.hello);
    });
});
`
)

testChanged(
  'transforms before blocks',
  `
  before(function () {
    this.hello = 'hi';
  });

  beforeEach(function () {
    this.goodbye = 'bye';
  });

  afterEach(function () {
    console.log(this.hello);
    console.log(this.goodbye);
  });

  describe('context', () => {
      it('should work', function () {
          console.log(this.hello);
          console.log(this.goodbye);
      });
  });
`,
  `
  let testContext;

  before(() => {
    testContext = {};
  });

  before(() => {
    testContext.hello = 'hi';
  });

  beforeEach(() => {
    testContext.goodbye = 'bye';
  });

  afterEach(() => {
    console.log(testContext.hello);
    console.log(testContext.goodbye);
  });

  describe('context', () => {
      it('should work', () => {
          console.log(testContext.hello);
          console.log(testContext.goodbye);
      });
  });
`
)

testChanged(
  'does not transform mocha specific methods',
  `
describe('foo', function () {
    it('should keep mocha methods', function() {
        this.timeout(500);
        this.slow(100);
        this.retries(2);
        this.skip();
    });
});
`,
  `
describe('foo', () => {
    it('should keep mocha methods', () => {
        this.timeout(500);
        this.slow(100);
        this.retries(2);
        this.skip();
    });
});
`
)

testChanged(
  'ignores a function in an array',
  `
describe('foo', function() {
    it('should tolerate an array of functions', function() {
        foo.apply(model, [
            function() {
                bar();
            }
        ]);
    });
});
`,
  `
describe('foo', () => {
    it('should tolerate an array of functions', () => {
        foo.apply(model, [
            function() {
                bar();
            }
        ]);
    });
});
`
)

testChanged(
  'adds any type to the test context with typescript (tsx)',
  `
  beforeEach(function () {
      this.hello = 'hi';
  });

  afterEach(function () {
      console.log(this.hello);
  });

  describe('context', () => {
      it('should work', function () {
          console.log(this.hello);
      });
  });
  `,
  `
  let testContext: any;

  beforeEach(() => {
      testContext = {};
  });

  beforeEach(() => {
      testContext.hello = 'hi';
  });

  afterEach(() => {
      console.log(testContext.hello);
  });

  describe('context', () => {
      it('should work', () => {
          console.log(testContext.hello);
      });
  });
  `,
  { parser: 'tsx' }
)

testChanged(
  'adds any type to the test context with typescript (ts)',
  `
beforeEach(function () {
    this.hello = 'hi';
});

afterEach(function () {
    console.log(this.hello);
});

describe('context', () => {
    it('should work', function () {
        console.log(this.hello);
    });
});
`,
  `
let testContext: any;

beforeEach(() => {
    testContext = {};
});

beforeEach(() => {
    testContext.hello = 'hi';
});

afterEach(() => {
    console.log(testContext.hello);
});

describe('context', () => {
    it('should work', () => {
        console.log(testContext.hello);
    });
});
`,
  { parser: 'ts' }
)
