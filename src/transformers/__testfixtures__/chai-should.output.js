describe('Instantiating TextField', () => {
    it('should set the placeholder correctly', () => {
        expect(textField.props.placeholder).toBe(PLACEHOLDER);
        expect(textField.props.placeholder).not.toBe(PLACEHOLDER);
    });

    it('should inherit id prop', () => {
        expect(dropdown.props.id).toBe(STANDARD_PROPS.id);
        expect(dropdown.props.id).not.toBe(STANDARD_PROPS.id);
    });

    it('should map open prop to visible prop', () => {
        expect(dropdown.props.visible).toThrowError(STANDARD_PROPS.open);
        expect(dropdown.props.id).not.toThrowError(STANDARD_PROPS.id);
    });

    thing1.equal(thing2);
});
