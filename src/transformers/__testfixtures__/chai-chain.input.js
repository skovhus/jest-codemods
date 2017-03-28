describe('Instantiating TextField', () => {
    it('should set the placeholder correctly', () => {
        textField.props.placeholder.should.equal(PLACEHOLDER);
        textField.props.placeholder.should.not.equal(PLACEHOLDER);
    });

    it('should inherit id prop', () => {
        dropdown.props.id.should.equal(STANDARD_PROPS.id);
        dropdown.props.id.should.not.equal(STANDARD_PROPS.id);
    });

    it('should map open prop to visible prop', () => {
        dropdown.props.visible.should.Throw(STANDARD_PROPS.open);
        dropdown.props.id.should.not.Throw(STANDARD_PROPS.id);
    });

    thing1.equal(thing2);
});

// simple referencing
const obj = { foo: 'bar' };
expect(obj).to.have.property('foo');
expect(obj).to.have.property('foo', 'bar');
