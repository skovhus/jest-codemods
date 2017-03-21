'use strict';

const test = { a: { b: '123' }, c: 123 };

// original: test.a.b.should.eql('123')
test.a.b.should.eql('123');

// original: test.c.should.equals(123)
test.c.should.equals(123);

