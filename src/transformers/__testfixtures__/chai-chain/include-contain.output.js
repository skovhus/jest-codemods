expect('foobar').toContain('bar');
expect([1, 2, 3]).toContain(2);
expect('foobar').toContain('foo');
expect({ foo: 1, bar: 2 }).toEqual(jasmine.objectContaining({ bar: 2 }));
