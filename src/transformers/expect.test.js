/* eslint-env jest */
import chalk from 'chalk';
import { wrapPlugin } from '../utils/test-helpers';
import plugin from './expect';

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
      expect(stuff).toExist();
    })
    `,
    `
    const test = require("testlib");
    test(t => {
      expect(stuff).toExist();
    })
    `
);

testChanged(
    'changes code without expect require/import if skipImportDetection is set',
    `
    test(t => {
      expect(stuff).toExist();
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
    import expect from 'expect';

    test(() => {
      expect(stuff).toExist();
      expect(stuff).toExist('message');
      expect(stuff).toBeTruthy();
      expect(stuff).toBeTruthy('message');

      expect(stuff).toNotExist();
      expect(stuff).toNotExist('message');
      expect(stuff).toBeFalsy();
      expect(stuff).toBeFalsy('message');

      expect(stuff).toBe(null);
      expect(stuff).toBe(null, 'message');

      expect(stuff).toNotBe(42);
      expect(stuff).toNotBe(42, 'message');

      expect(stuff).toNotEqual({}, 'message');
      expect(stuff).toNotEqual(42);

      expect(stuff).toThrow();
      expect(stuff).toThrow(/bum/);
      expect(stuff).toThrow(/bum/, 'yes sir');

      expect(stuff).toNotThrow();
      expect(stuff).toNotThrow(/bum/);
      expect(stuff).toNotThrow(/bum/, 'yes sir');

      expect(stuff).toBeA('number');
      expect(stuff).toBeA('number', 'message');

      expect(stuff).toBeAn(Array);
      expect(new Stuff).toBeAn(Stuff, 'Message');

      expect(stuff).toNotBeA(Number);
      expect(stuff).toNotBeAn(Array);

      expect(stuff).toMatch({foo: 'bar'});
      expect(stuff).toMatch({foo: 'bar'}, 'message');
      expect(stuff).toMatch('a string');
      expect(stuff).toMatch('a string', 'message');

      expect(stuff).toNotMatch({foo: 'bar'});
      expect(stuff).toNotMatch({foo: 'bar'}, 'message');
      expect(stuff).toNotMatch('a string');
      expect(stuff).toNotMatch('a string', 'message');

      expect(stuff).toHaveBeenCalled();
      expect(stuff).toNotHaveBeenCalled();
      expect(stuff).toNotHaveBeenCalled('msg');
      expect(stuff).toHaveBeenCalledWith('foo', 'bar');
    });
    `,
    `
    test(() => {
      expect(stuff).toBeTruthy();
      expect(stuff).toBeTruthy();
      expect(stuff).toBeTruthy();
      expect(stuff).toBeTruthy();

      expect(stuff).toBeFalsy();
      expect(stuff).toBeFalsy();
      expect(stuff).toBeFalsy();
      expect(stuff).toBeFalsy();

      expect(stuff).toBe(null);
      expect(stuff).toBe(null);

      expect(stuff).not.toBe(42);
      expect(stuff).not.toBe(42);

      expect(stuff).not.toEqual({});
      expect(stuff).not.toEqual(42);

      expect(stuff).toThrow();
      expect(stuff).toThrow(/bum/);
      expect(stuff).toThrow(/bum/);

      expect(stuff).not.toThrow();
      expect(stuff).not.toThrow(/bum/);
      expect(stuff).not.toThrow(/bum/);

      expect(typeof stuff).toBe('number');
      expect(typeof stuff).toBe('number');

      expect(stuff).toBeInstanceOf(Array);
      expect(new Stuff).toBeInstanceOf(Stuff);

      expect(stuff).not.toBeInstanceOf(Number);
      expect(stuff).not.toBeInstanceOf(Array);

      expect(stuff).toMatchObject({foo: 'bar'});
      expect(stuff).toMatchObject({foo: 'bar'});
      expect(stuff).toMatch('a string');
      expect(stuff).toMatch('a string');

      expect(stuff).not.toMatchObject({foo: 'bar'});
      expect(stuff).not.toMatchObject({foo: 'bar'});
      expect(stuff).not.toMatch('a string');
      expect(stuff).not.toMatch('a string');

      expect(stuff).toHaveBeenCalled();
      expect(stuff).not.toHaveBeenCalled();
      expect(stuff).not.toHaveBeenCalled();
      expect(stuff).toHaveBeenCalledWith('foo', 'bar');
    });
    `
);

testChanged(
    'maps expect number matchers',
    `
    import expect from 'expect';

    test(() => {
      expect(stuff).toBeLessThan(42);
      expect(stuff).toBeFewerThan(42);
      expect(stuff).toBeLessThanOrEqualTo(42);
      expect(stuff).toBeMoreThan(42);
      expect(stuff).toBeGreaterThanOrEqualTo(42);
    });
    `,
    `
    test(() => {
      expect(stuff).toBeLessThan(42);
      expect(stuff).toBeLessThan(42);
      expect(stuff).toBeLessThanOrEqual(42);
      expect(stuff).toBeGreaterThan(42);
      expect(stuff).toBeGreaterThanOrEqual(42);
    });
    `
);

testChanged(
    'maps expect contain matchers',
    `
    import expect from 'expect';

    test(() => {
      expect(stuff).toInclude(1);
      expect(stuff).toInclude(1, 'msg');
      expect(stuff).toExclude('world');
      expect(stuff).toNotContain({b: 2});
      expect(stuff).toNotInclude('world');

      expect({ a: 1 }).toIncludeKey('a');
      expect({ a: 1 }).toExcludeKey('b');

      expect({ a: 1, b: 2 }).toIncludeKeys([ 'a', 'b' ]);
      expect({ a: 1, b: 2 }).toExcludeKeys([ 'c', 'd' ]);
    });
    `,
    `
    test(() => {
      expect(stuff).toContain(1);
      expect(stuff).toContain(1);
      expect(stuff).not.toContain('world');
      expect(stuff).not.toContain({b: 2});
      expect(stuff).not.toContain('world');

      expect(Object.keys({ a: 1 })).toContain('a');
      expect(Object.keys({ a: 1 })).not.toContain('b');

      [ 'a', 'b' ].forEach(e => {
        expect(Object.keys({ a: 1, b: 2 })).toContain(e);
      });
      [ 'c', 'd' ].forEach(e => {
        expect(Object.keys({ a: 1, b: 2 })).not.toContain(e);
      });
    });
    `
);

testChanged(
    'maps expect spy matchers',
    `
    import expect from 'expect';

    test(() => {
      expect(stuff).toHaveBeenCalled();
      expect(stuff).toNotHaveBeenCalled();
      expect(stuff).toHaveBeenCalledWith('foo', 'bar');
    });
    `,
    `
    test(() => {
      expect(stuff).toHaveBeenCalled();
      expect(stuff).not.toHaveBeenCalled();
      expect(stuff).toHaveBeenCalledWith('foo', 'bar');
    });
    `
);

testChanged(
    'maps spy creation calls',
    `
    import expect from 'expect';

    test(() => {
      var spy1 = expect.createSpy();
      var spy2 = expect.spyOn(video, 'play');
      var spyOn;

      spyOn = expect.spyOn(video, 'play');
      spyOn = expect.spyOn(video, 'play').andCall(fn);
      spyOn = expect.spyOn(video, 'play').andReturn(42);
      spyOn = expect.spyOn(video, 'play').andThrow(new Error('bum'));

      expect.createSpy().andCall(fn);
      expect.createSpy().andReturn(value);

      not.a.spy.andCall(fn);
    });
    `,
    `
    test(() => {
      var spy1 = jest.fn();
      var spy2 = jest.spyOn(video, 'play');
      var spyOn;

      spyOn = jest.spyOn(video, 'play');
      spyOn = jest.spyOn(video, 'play').mockImplementation(fn);
      spyOn = jest.spyOn(video, 'play').mockImplementation(() => 42);
      spyOn = jest.spyOn(video, 'play').mockImplementation(() => {
        throw new Error('bum');
      });

      jest.fn().mockImplementation(fn);
      jest.fn().mockImplementation(() => value);

      not.a.spy.andCall(fn);
    });
    `
);

testChanged(
    'maps spy methods on intitialized spies',
    `
    import expect from 'expect';

    test(() => {
      var spy1 = expect.createSpy();
      var spy2 = expect.spyOn(video, 'play');
      var spy3 = expect.spyOn(video, 'play');
      const parse = expect.createSpy(value => 'parsed-' + value).andCallThrough();

      spy1.andCall(fn);
      spy2.andReturn(42);
      spy3.andThrow(new Error('bum'));

      not.a.spy.andCall(fn);
      not.a.spy.andReturn(fn);
      not.a.spy.andThrow(fn);

      expect(spy1.calls.length).toBe(2);
      expect(spy2.calls[i].arguments[j]).toBe('yes');
      expect(spy2.calls[0].arguments[3]).toBe('yes');
      expect(spy2.calls[2].arguments).toEqual(1);

      spy1.restore();
      spy2.reset();
    });
    `,
    `
    test(() => {
      var spy1 = jest.fn();
      var spy2 = jest.spyOn(video, 'play');
      var spy3 = jest.spyOn(video, 'play');
      const parse = jest.fn(value => 'parsed-' + value);

      spy1.mockImplementation(fn);
      spy2.mockImplementation(() => 42);
      spy3.mockImplementation(() => {
        throw new Error('bum');
      });

      not.a.spy.andCall(fn);
      not.a.spy.andReturn(fn);
      not.a.spy.andThrow(fn);

      expect(spy1.mock.calls.length).toBe(2);
      expect(spy2.mock.calls[i][j]).toBe('yes');
      expect(spy2.mock.calls[0][3]).toBe('yes');
      expect(spy2.mock.calls[2]).toEqual(1);

      spy1.mockReset();
      spy2.mockClear();
    });
    `
);

testChanged(
    'maps spy methods on intitialized spies (spread import)',
    `
    import { createSpy, spyOn } from 'expect'

    test(() => {
      var spy1 = createSpy();
      var spy2 = spyOn(video, 'play');
      const parse = createSpy(value => 'parsed-' + value).andCallThrough();

      spy1.restore();
      spy2.reset();
    });
    `,
    `
    test(() => {
      var spy1 = jest.fn();
      var spy2 = jest.spyOn(video, 'play');
      const parse = jest.fn(value => 'parsed-' + value);

      spy1.mockReset();
      spy2.mockClear();
    });
    `
);

testChanged(
    'maps spy array',
    `
    import { createSpy, spyOn } from 'expect'

    test(() => {
      const inputs = [
        createSpy(props => <input {...props.input} />).andCallThrough(),
        createSpy(props => <input {...props.input} />).andCallThrough(),
        createSpy(props => <input {...props.input} />).andCallThrough()
      ]
      expect(inputs[0]).toNotHaveBeenCalled()
      expect(inputs[1]).toHaveBeenCalled()
      expect(inputs[1].calls.length).toEqual(1)
    });
    `,
    `
    test(() => {
      const inputs = [
        jest.fn(props => <input {...props.input} />),
        jest.fn(props => <input {...props.input} />),
        jest.fn(props => <input {...props.input} />)
      ]
      expect(inputs[0]).not.toHaveBeenCalled()
      expect(inputs[1]).toHaveBeenCalled()
      expect(inputs[1].mock.calls.length).toEqual(1)
    });
    `
);

testChanged(
    'renames non standard expect import name',
    `
    import exp from 'expect';

    test(() => {
      exp(stuff).toHaveBeenCalled();
      exp(stuff).toNotHaveBeenCalled();
      exp(stuff).toHaveBeenCalledWith(1);
    });
    `,
    `
    test(() => {
      expect(stuff).toHaveBeenCalled();
      expect(stuff).not.toHaveBeenCalled();
      expect(stuff).toHaveBeenCalledWith(1);
    });
    `
);

testChanged(
    'support chaining',
    `
    import expect from 'expect';

    test(() => {
       expect(stuff)
         .toExist()
         .toBeA('number')
         .toNotBe(4)
         .toBeMoreThan(42);
    });
    `,
    `
    test(() => {
      expect(stuff).toBeTruthy();
      expect(typeof stuff).toBe('number');
      expect(stuff).not.toBe(4);
      expect(stuff).toBeGreaterThan(42);
    });
    `
);

testChanged(
    'standaloneMode: keeps expect import',
    `
    import exp from 'expect';

    test(() => {
      exp(stuff).toHaveBeenCalled();
    });
    `,
    `
    import exp from 'expect';

    test(() => {
      exp(stuff).toHaveBeenCalled();
    });
    `,
    {
        standaloneMode: true,
    }
);

testChanged(
    'standaloneMode: rewrites expect.spyOn (import)',
    `
    import expect from 'expect';

    test(() => {
        var spy1 = expect.createSpy();
        var spy2 = expect.spyOn(video, 'play');

        spy1.restore();
        spy1.reset();
        expect(spy1.calls.length).toEqual(3);
    });
    `,
    `
    import mock from 'jest-mock';
    import expect from 'expect';

    test(() => {
        var spy1 = mock.fn();
        var spy2 = mock.spyOn(video, 'play');

        spy1.mockReset();
        spy1.mockClear();
        expect(spy1.mock.calls.length).toEqual(3);
    });
    `,
    {
        standaloneMode: true,
    }
);

testChanged(
    'standaloneMode: rewrites expect.spyOn (require)',
    `
    const expect = require('expect');

    test(() => {
        var spy1 = expect.createSpy();
        var spy2 = expect.spyOn(video, 'play');
        expect(spy1.calls.length).toEqual(3);
    });
    `,
    `
    const mock = require('jest-mock');
    const expect = require('expect');

    test(() => {
        var spy1 = mock.fn();
        var spy2 = mock.spyOn(video, 'play');
        expect(spy1.mock.calls.length).toEqual(3);
    });
    `,
    {
        standaloneMode: true,
    }
);

test('warns about unsupported spy features', () => {
    wrappedPlugin(
        `
        import expect from 'expect';

        test(() => {
          expect.restoreSpies();
          expect(expect.isSpy(spy)).toBe(true);
        });
    `
    );
    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 5) "restoreSpies" is currently not supported',
        'jest-codemods warning: (test.js line 6) "isSpy" is currently not supported',
    ]);
});

test('warns about creating spies without assigning it to a variable', () => {
    wrappedPlugin(
        `
        import expect from 'expect'

        test(() => {
            expect.spyOn(console, 'error');
            expect(console.error.calls.length).toEqual(0);
        });
    `
    );
    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 5) "spyOn" without variable assignment might not work as expected (see https://facebook.github.io/jest/docs/jest-object.html#jestspyonobject-methodname)',
    ]);
});

test('warns about expect.extend usage', () => {
    wrappedPlugin(
        `
        import expect from 'expect'
        import expectElement from 'expect-element'

        expect.extend(expectElement);
    `
    );
    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 5) "extend" is currently not supported',
    ]);
});

test('warns about unknown matchers', () => {
    wrappedPlugin(
        `
        import expect from 'expect';

        test(() => {
            expect(age).toPass(n => n >= 18);
        });
    `
    );
    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 5) Unknown matcher "toPass"',
    ]);
});

test('warns about toMatch usage on variables', () => {
    const result = wrappedPlugin(
        `
        import expect from 'expect'

        test(() => {
          expect(stuff).toMatch(variable);
          expect(stuff).toNotMatch(variable);
        });
        `
    );

    expect(result).toEqual(
        `
        test(() => {
          expect(stuff).toMatchObject(variable);
          expect(stuff).not.toMatchObject(variable);
        });
        `
    );

    expect(consoleWarnings).toEqual([
        'jest-codemods warning: (test.js line 5) Use "toMatch" if "variable" is not an object',
        'jest-codemods warning: (test.js line 6) Use "toMatch" if "variable" is not an object',
    ]);
});

test('warns about unsupported number of arguments (comparator)', () => {
    wrappedPlugin(
        `
        import expect from 'expect';

        test(() => {
            expect({ a: 1, b: 2 }).toContainKey([ 'a', 'b' ], myFunc, 'msg');
            expect({ a: 1, b: 2 }).toContain({ b: 2 }, myComparator);
            expect({ a: 1, b: 2 }).toExclude([ 'a', 'b' ], myFunc);
            expect({ a: 1, b: 2 }).toExcludeKey([ 'a', 'b' ], myFunc);
            expect({ a: 1, b: 2 }).toInclude({ b: 2 }, myComparator);
            expect({ a: 1, b: 2 }).toIncludeKeys([ 'a', 'b' ], () => {});
            expect({ a: 1, b: 2 }).toNotContain([ 'a', 'b' ], myFunc, 'msg');
            expect({ a: 1, b: 2 }).toNotContainKey([ 'a', 'b' ], myFunc);
            expect({ a: 1, b: 2 }).toNotInclude([ 'a', 'b' ], myFunc, 'msg');
            expect({ a: 1, b: 2 }).toNotIncludeKey([ 'a', 'b' ], myFunc);
        });
    `
    );
    const firstErrorLine = 5;
    const numberOfErrors = 10;
    expect(consoleWarnings).toEqual(
        [...Array(numberOfErrors).keys()].map(
            e =>
                `jest-codemods warning: (test.js line ${e +
                    firstErrorLine}) Too many arguments given to "toContain". Expected max 1 but got 2`
        )
    );
});
