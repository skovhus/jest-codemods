'use strict';

const test = { a: { b: '123' }, c: 123 };

// original: test.a.b.should.eql('123')
test.a.b.should.eql('123');

// original: test.c.should.equals(123)
test.c.should.equals(123);

test.should.be.a('string');

test.should.equal('bar');

test.should.have.lengthOf(3);

test.should.have.property('tea').with.lengthOf(3);

// original: should.exist(test.a)
should.exist(test.a);

// original: should.not.exist(test.a.b);
should.not.exist(test.a.b);

