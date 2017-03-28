expect(Object.getOwnPropertyDescriptor('test', 'length')).not.toBeUndefined();
expect(Object.getOwnPropertyDescriptor('test', 'length')).toEqual({ enumerable: false, configurable: false, writable: false, value: 4 });
expect(Object.getOwnPropertyDescriptor('test', 'length')).toEqual({ enumerable: false, configurable: false, writable: false, value: 3 });
