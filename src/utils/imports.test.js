/* eslint-env jest */
import jscodeshift from 'jscodeshift';

import { hasRequireOrImport, removeRequireAndImport } from './imports';

const j = jscodeshift;

describe('removeRequireAndImport', () => {
    it('removes require statements', () => {
        const ast = j(`
            const x = require('foo');
            x();
        `);
        const removedVariableName = removeRequireAndImport(j, ast, 'foo');
        expect(removedVariableName).toBe('x');
        expect(ast.toSource()).toEqual(`
            x();
        `);
    });

    it('removes require statements with calls', () => {
        const ast = j(`
            const x = require('foo').bar();
            x();
        `);
        const removedVariableName = removeRequireAndImport(j, ast, 'foo');
        expect(removedVariableName).toBe('x');
        expect(ast.toSource()).toEqual(`
            x();
        `);
    });

    it('removes import statements', () => {
        const ast = j(`
            import xx from 'baz';
            xx();
        `);
        const removedVariableName = removeRequireAndImport(j, ast, 'baz');
        expect(removedVariableName).toBe('xx');
        expect(ast.toSource()).toEqual(`
            xx();
        `);
    });

    it('retain first line comments', () => {
        const ast = j(`
            // @flow
            /* eslint... */
            import xx from 'baz';
            xx();
        `);
        const removedVariableName = removeRequireAndImport(j, ast, 'baz');
        expect(removedVariableName).toBe('xx');
        expect(ast.toSource()).toEqual(`
            // @flow
            /* eslint... */
            xx();
        `);
    });

    it('does not touch code without the given import', () => {
        const inputSource = `
            // @flow
            /* eslint... */
            import xx from 'baz';
            xx();
        `;
        const ast = j(inputSource);
        const removedVariableName = removeRequireAndImport(j, ast, 'foo');
        expect(removedVariableName).toBe(null);
        expect(ast.toSource()).toEqual(inputSource);
    });
});

describe('hasRequireOrImport', () => {
    it('detects requires', () => {
        const ast = j('const xx = require("bar")');
        const hasImport = hasRequireOrImport(j, ast, 'bar');
        expect(hasImport).toBe(true);
    });

    it('detects imports', () => {
        const ast = j('import xx from "baz"');
        const hasImport = hasRequireOrImport(j, ast, 'baz');
        expect(hasImport).toBe(true);
    });

    it('detects no imports', () => {
        const ast = j('import xx from "baz"');
        const hasImport = hasRequireOrImport(j, ast, 'xxx');
        expect(hasImport).toBe(false);
    });
});
