expect(typeof 'test').toBe('string');
expect(typeof { foo: 'bar' }).toBe('object');
expect(null).toBeNull();
expect(undefined).toBeUndefined();
expect(typeof new Error()).toBe('error');
expect(typeof new Promise()).toBe('promise');
expect(typeof new Float32Array()).toBe('float32array');
expect(typeof Symbol()).toBe('symbol');
