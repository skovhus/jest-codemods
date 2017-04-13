expect([1, 2, 3]).toEqual(expect.arrayContaining([3, 2]));
expect([1, 2, 3]).not.toEqual(expect.arrayContaining([3, 2, 8]));

expect([4, 2]).toEqual(expect.arrayContaining([2, 4]));
expect([5, 2]).not.toEqual(expect.arrayContaining([5, 2, 1]));

expect([{ id: 1 }]).toEqual(expect.arrayContaining([{ id: 1 }]));

expect({ id: 1 }).toEqual(expect.objectContaining({ id: 1 }));
