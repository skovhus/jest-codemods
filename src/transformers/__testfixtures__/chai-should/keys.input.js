expect([1, 2, 3]).to.have.all.keys(1, 2);
expect({ foo: 1, bar: 2 }).to.have.all.keys({ bar: 6, foo: 7 });
expect({ foo: 1, bar: 2, baz: 3 }).to.contain.all.keys(['bar', 'foo']);
expect({ foo: 1, bar: 2, baz: 3 }).to.contain.all.keys({ bar: 6 });
