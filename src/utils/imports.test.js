/* eslint-env jest */
import jscodeshift from 'jscodeshift';

import {
    getRequireOrImportName,
    hasRequireOrImport,
    removeRequireAndImport,
} from './imports';

const j = jscodeshift;

describe('removeRequireAndImport', () => {
    it('removes require statements', () => {
        const ast = j(
            `
            const x = require('foo');
            x();
        `
        );
        const removedVariableName = removeRequireAndImport(j, ast, 'foo');
        expect(removedVariableName).toBe('x');
        expect(ast.toSource()).toEqual(
            `
            x();
        `
        );
    });

    it('removes require statements without local name', () => {
        const ast = j(
            `
            require('foo');
            console.log('yes');
        `
        );
        const removedVariableName = removeRequireAndImport(j, ast, 'foo');
        expect(removedVariableName).toBeNull();
        expect(ast.toSource()).toEqual(
            `
            console.log('yes');
        `
        );
    });

    it('removes require statements with calls', () => {
        const ast = j(
            `
            const x = require('foo').bar();
            x();
        `
        );
        const removedVariableName = removeRequireAndImport(j, ast, 'foo');
        expect(removedVariableName).toBe('x');
        expect(ast.toSource()).toEqual(
            `
            x();
        `
        );
    });

    it('removes require statements with given specifier', () => {
        const ast = j(
            `
            const x = require('foo').bar;
            x();
        `
        );
        const removedVariableName = removeRequireAndImport(j, ast, 'foo', 'bar');
        expect(removedVariableName).toBe('x');
        expect(ast.toSource()).toEqual(
            `
            x();
        `
        );
    });

    it('retains require statements without given specifier', () => {
        const ast = j(
            `
            const x = require('foo').bar;
            require('foo').baz();
            x();
        `
        );
        const removedVariableName = removeRequireAndImport(j, ast, 'foo', 'bop');
        expect(removedVariableName).toBeNull();
        expect(ast.toSource()).toEqual(
            `
            const x = require('foo').bar;
            require('foo').baz();
            x();
        `
        );
    });

    it('removes import statements', () => {
        const ast = j(
            `
            import xx from 'baz';
            xx();
        `
        );
        const removedVariableName = removeRequireAndImport(j, ast, 'baz');
        expect(removedVariableName).toBe('xx');
        expect(ast.toSource()).toEqual(
            `
            xx();
        `
        );
    });

    it('removes import statements without local name', () => {
        const ast = j(
            `
            import 'baz';
            console.log('yes');
        `
        );
        const removedVariableName = removeRequireAndImport(j, ast, 'baz');
        expect(removedVariableName).toBeNull();
        expect(ast.toSource()).toEqual(
            `
            console.log('yes');
        `
        );
    });

    it('removes import statements with specifiers', () => {
        const ast = j(
            `
            import { xx } from 'baz';
            xx();
        `
        );
        const removedVariableName = removeRequireAndImport(j, ast, 'baz', 'xx');
        expect(removedVariableName).toBe('xx');
        expect(ast.toSource()).toEqual(
            `
            xx();
        `
        );
    });

    it('removes import statements with specifiers', () => {
        const ast = j(
            `
            import { xx as foo } from 'baz';
            xx();
        `
        );
        const removedVariableName = removeRequireAndImport(j, ast, 'baz', 'xx');
        expect(removedVariableName).toBe('foo');
        expect(ast.toSource()).toEqual(
            `
            xx();
        `
        );
    });

    it('retains import statements without specifiers', () => {
        const ast = j(
            `
            import { xx } from 'baz';
            xx();
        `
        );
        const removedVariableName = removeRequireAndImport(j, ast, 'baz', 'yy');
        expect(removedVariableName).toBeNull();
        expect(ast.toSource()).toEqual(
            `
            import { xx } from 'baz';
            xx();
        `
        );
    });

    it('retain first line comments', () => {
        const ast = j(
            `
            // @flow
            /* eslint... */
            import xx from 'baz';
            xx();
        `
        );
        const removedVariableName = removeRequireAndImport(j, ast, 'baz');
        expect(removedVariableName).toBe('xx');
        expect(ast.toSource()).toEqual(
            `
            // @flow
            /* eslint... */
            xx();
        `
        );
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

describe('hasRequireOrImport and getRequireOrImportName', () => {
    it('detects requires', () => {
        const ast = j('const xx = require("bar")');
        const hasImport = hasRequireOrImport(j, ast, 'bar');
        expect(hasImport).toBe(true);
        expect(getRequireOrImportName(j, ast, 'bar')).toBe('xx');
    });

    it('detects requires spreads', () => {
        const ast = j('const { xx } = require("baz")');
        const hasImport = hasRequireOrImport(j, ast, 'baz');
        expect(hasImport).toBe(true);
        expect(getRequireOrImportName(j, ast, 'baz')).toBe(undefined);
    });

    it('detects imports', () => {
        const ast = j('import xx from "baz"');
        const hasImport = hasRequireOrImport(j, ast, 'baz');
        expect(hasImport).toBe(true);
        expect(getRequireOrImportName(j, ast, 'baz')).toBe('xx');
    });

    it('detects imports spreads', () => {
        const ast = j('import { xx } from "baz"');
        const hasImport = hasRequireOrImport(j, ast, 'baz');
        expect(hasImport).toBe(true);
        expect(getRequireOrImportName(j, ast, 'baz')).toBe(null);
    });

    it('detects no imports', () => {
        const ast = j('import xx from "baz"');
        const hasImport = hasRequireOrImport(j, ast, 'xxx');
        expect(hasImport).toBe(false);
        expect(getRequireOrImportName(j, ast, 'xxx')).toBeNull();
    });
});
