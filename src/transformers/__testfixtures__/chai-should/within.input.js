expect(7).to.be.within(5, 10);

expect('foo').to.have.length.within(2, 4);
expect([1, 2, 3]).to.have.length.within(2, 4);

expect('foo').to.have.length.within(2, 4, 'error message');

(5).should.be.within(2, 4);
