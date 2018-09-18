/* eslint-env jest */
import chalk from 'chalk';
import { wrapPlugin } from '../utils/test-helpers';
import plugin from './expect-js';

chalk.enabled = false;
const wrappedPlugin = wrapPlugin(plugin);

let consoleWarnings = [];
beforeEach(() => {
    consoleWarnings = [];
    console.warn = v => consoleWarnings.push(v);
});

function testChanged(msg, source, expectedOutput, options = {}) {
    test(msg, () => {
        const result = wrappedPlugin(source, options);
        expect(result).toBe(expectedOutput);
        expect(consoleWarnings).toEqual([]);

        // Running it twice should yield same result
        expect(wrappedPlugin(result, options)).toBe(result);
    });
}

testChanged(
    'does not touch code without expect require/import',
    `
    const test = require("testlib");
    test(t => {
      expect(stuff).to.be.ok();
    })
    `,
    `
    const test = require("testlib");
    test(t => {
      expect(stuff).to.be.ok();
    })
    `
);

testChanged(
    'changes code without expect require/import if skipImportDetection is set',
    `
    test(t => {
      expect(stuff).to.be.ok();
    })
    `,
    `
    test(t => {
      expect(stuff).toBeTruthy();
    })
    `,
    { skipImportDetection: true }
);

testChanged(
    'maps expect matchers',
    `
    import expect from 'expect.js';

    test(() => {
      expect(stuff).to.be.ok();
      expect(stuff).to.not.be.ok();

      expect(stuff).to.be('message');
      expect(stuff).to.equal('message');

      expect(stuff).to.eql('message');

      expect(stuff).to.contain('message');

      expect(stuff).to.have.length(1);
      expect(stuff).to.be.empty();

      expect(stuff).to.have.property('message');
      expect(stuff).to.have.key('message');

      expect(stuff).to.match('message');
    });
    `,
    `
    test(() => {
      expect(stuff).toBeTruthy();
      expect(stuff).toBeFalsy();

      expect(stuff).toBe('message');
      expect(stuff).toBe('message');

      expect(stuff).toEqual('message');

      expect(stuff).toContain('message');

      expect(stuff).toHaveLength(1);
      expect(stuff).toHaveLength(0);

      expect(stuff).toHaveProperty('message');
      expect(stuff).toHaveProperty('message');

      expect(stuff).toMatch('message');
    });
    `
);

testChanged(
    'does not map non expect.js matchers',
    `
    import expect from 'expect.js';

    test(() => {
      bob(stuff).to.be.ok();
      expect(stuff).to.be.bananas();
    });
    `,
    `
    test(() => {
      bob(stuff).to.be.ok();
      expect(stuff).to.be.bananas();
    });
    `
);

testChanged(
    'maps expect not matchers',
    `
    import expect from 'expect.js';

    test(() => {
      expect(stuff).to.not.be('message');
      expect(stuff).to.not.equal('message');

      expect(stuff).to.not.eql('message');

      expect(stuff).to.not.contain('message');

      expect(stuff).to.not.have.length(1);

      expect(stuff).to.not.have.property('message');

      expect(stuff).to.not.match('message');
    });
    `,
    `
    test(() => {
      expect(stuff).not.toBe('message');
      expect(stuff).not.toBe('message');

      expect(stuff).not.toEqual('message');

      expect(stuff).not.toContain('message');

      expect(stuff).not.toHaveLength(1);

      expect(stuff).not.toHaveProperty('message');

      expect(stuff).not.toMatch('message');
    });
    `
);

testChanged(
    'maps expect number matchers',
    `
    import expect from 'expect.js';

    test(() => {
      expect(stuff).to.be.lessThan(42);
      expect(stuff).to.be.below(42);
      expect(stuff).to.be.lt(42);
      expect(stuff).to.be.greaterThan(42);
      expect(stuff).to.be.above(42);
      expect(stuff).to.be.gt(42);
    });
    `,
    `
    test(() => {
      expect(stuff).toBeLessThan(42);
      expect(stuff).toBeLessThan(42);
      expect(stuff).toBeLessThan(42);
      expect(stuff).toBeGreaterThan(42);
      expect(stuff).toBeGreaterThan(42);
      expect(stuff).toBeGreaterThan(42);
    });
    `
);

testChanged(
    'maps expect throw matchers',
    `
    import expect from 'expect.js';

    test(() => {
      expect(stuff).to.throwError(Error);
      expect(stuff).to.throwError();
      expect(stuff).to.throw(Error);
      expect(stuff).to.throw();
      expect(fn).to.throwException(function (e) {
        expect(e).to.be.a(SyntaxError);
      });
      expect(() => {
        return new items.Episode({});
      }).to.throwError(function(e) {
        expect(e).to.be.a(SyntaxError);
      });
      expect(function stuff() {
        return new items.Episode({});
      }).to.throwError(function(e) {
        expect(e).to.be.a(SyntaxError);
      });
    });
    `,
    `
    test(() => {
      expect(stuff).toThrowError(Error);
      expect(stuff).toThrow();
      expect(stuff).toThrowError(Error);
      expect(stuff).toThrow();

      try {
        fn();
        throw Error('Function did not throw');
      } catch (e) {
        expect(e).toBeInstanceOf(SyntaxError);
      }

      try {
        (() => {
          return new items.Episode({});
        })();

        throw Error('Function did not throw');
      } catch (e) {
        expect(e).toBeInstanceOf(SyntaxError);
      }

      try {
        (function stuff() {
          return new items.Episode({});
        })();

        throw Error('Function did not throw');
      } catch (e) {
        expect(e).toBeInstanceOf(SyntaxError);
      }
    });
    `
);

testChanged(
    'maps expect fail matchers',
    `
    import expect from 'expect.js';

    test(() => {
      expect().fail('message');
    });
    `,
    `
    test(() => {
      throw Error('message');
    });
    `
);

testChanged(
    'maps expect a and an matchers',
    `
    import expect from 'expect.js';

    test(() => {
      expect(stuff).to.be.a('function');
      expect(stuff).to.be.a('string');
      expect(stuff).to.be.a('object');
      expect(stuff).to.be.a('array');
      expect(stuff).to.be.a('boolean');
      expect(stuff).to.be.a('symbol');
      expect(stuff).to.be.a('number');
      expect(stuff).to.be.a(Thing);

      expect(stuff).to.be.an('function');
      expect(stuff).to.be.an('string');
      expect(stuff).to.be.an('object');
      expect(stuff).to.be.an('array');
      expect(stuff).to.be.an('boolean');
      expect(stuff).to.be.an('symbol');
      expect(stuff).to.be.an('number');
      expect(stuff).to.be.an(Thing);
    });
    `,
    `
    test(() => {
      expect(typeof stuff).toBe('function');
      expect(typeof stuff).toBe('string');
      expect(typeof stuff).toBe('object');
      expect(stuff).toBeInstanceOf(Array);
      expect(typeof stuff).toBe('boolean');
      expect(typeof stuff).toBe('symbol');
      expect(typeof stuff).toBe('number');
      expect(stuff).toBeInstanceOf(Thing);

      expect(typeof stuff).toBe('function');
      expect(typeof stuff).toBe('string');
      expect(typeof stuff).toBe('object');
      expect(stuff).toBeInstanceOf(Array);
      expect(typeof stuff).toBe('boolean');
      expect(typeof stuff).toBe('symbol');
      expect(typeof stuff).toBe('number');
      expect(stuff).toBeInstanceOf(Thing);
    });
    `
);

testChanged(
    'maps expect within matchers',
    `
    import expect from 'expect.js';

    test(() => {
      expect(stuff).to.be.within(0, 100);
    });
    `,
    `
    test(() => {
      expect(stuff > 0 && stuff < 100).toBeTruthy();
    });
    `
);

test('warns about unsupported matchers', () => {
    wrappedPlugin(
        `
        import expect from 'expect.js';

        test(() => {
          expect({ a: 'b', c: 'd' }).to.only.have.keys(['a', 'c']);
        });
    `
    );
    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 5) Unsupported Expect.js Assertion "*.keys"',
    ]);
});

testChanged(
    'standaloneMode: keeps Jest expect import',
    `
    import expect from 'expect.js';
    import exp from 'expect';

    test(() => {
      expect(stuff).to.be('message');
    });
    `,
    `
    import exp from 'expect';

    test(() => {
      expect(stuff).toBe('message');
    });
    `,
    {
        standaloneMode: true,
    }
);
