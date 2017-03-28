expect([1, 2, 3]).toEqual(jasmine.arrayContaining([1, 2]));
expect([1, 2, 3]).toEqual(jasmine.arrayContaining([1, 2]));
expect(Object.keys({ foo: 1, bar: 2 })).toEqual(jasmine.arrayContaining(Object.keys({ bar: 6, foo: 7 })));
expect(Object.keys({ foo: 1, bar: 2, baz: 3 })).toEqual(jasmine.arrayContaining(['bar', 'foo']));
expect(Object.keys({ foo: 1, bar: 2, baz: 3 })).toEqual(jasmine.arrayContaining(Object.keys({ bar: 6 })));
