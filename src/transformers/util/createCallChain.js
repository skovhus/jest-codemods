module.exports = j => (chain, args) => {
    const arr = chain.reverse();

    let val = arr.pop();
    let temp = (typeof val === 'string') ? j.identifier(val) : val;
    let curr = temp;

    while (chain.length) {
        val = arr.pop();
        temp = (typeof val === 'string') ? j.identifier(val) : val;
        curr = j.memberExpression(curr, temp);
    }

    return j.callExpression(curr, args);
};
