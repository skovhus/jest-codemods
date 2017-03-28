expect([1, 2, 3]).toEqual(jasmine.arrayContaining([3, 2]));
expect([1, 2, 3]).not.toEqual(jasmine.arrayContaining([3, 2, 8]));

expect([4, 2]).toEqual(jasmine.arrayContaining([2, 4]));
expect([5, 2]).not.toEqual(jasmine.arrayContaining([5, 2, 1]));

expect([{ id: 1 }]).toEqual(jasmine.arrayContaining([{ id: 1 }]));
