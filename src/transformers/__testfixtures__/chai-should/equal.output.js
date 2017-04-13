expect('hello').toBe('hello');
expect(42).toBe(42);
expect(1).not.toBe(true);
expect({ foo: 'bar' }).not.toBe({ foo: 'bar' });
expect({ foo: 'bar' }).toEqual({ foo: 'bar' });

expect('foo').toBe('foo');
expect('foo').not.toBe('bar');
