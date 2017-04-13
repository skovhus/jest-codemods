expect('hello').to.equal('hello');
expect(42).to.equal(42);
expect(1).to.not.equal(true);
expect({ foo: 'bar' }).to.not.equal({ foo: 'bar' });
expect({ foo: 'bar' }).to.deep.equal({ foo: 'bar' });

should.equal('foo', 'foo');
should.not.equal('foo', 'bar');
