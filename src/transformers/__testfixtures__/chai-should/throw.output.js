const err = new ReferenceError('This is a bad function.');
const fn = function() { throw err; };
expect(fn).toThrowError(ReferenceError);
expect(fn).toThrowError(Error);
expect(fn).toThrowError(/bad function/);
expect(fn).not.toThrowError('good function');
expect(fn).toThrowError(ReferenceError, /bad function/);
expect(fn).toThrowError(err);
