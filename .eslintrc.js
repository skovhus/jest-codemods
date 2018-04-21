module.exports = {
    extends: ['eslint:recommended', 'prettier'],
    parser: 'babel-eslint',
    plugins: ['import', 'prettier'],
    env: {
        node: true,
        es6: true,
    },
    root: true,
    rules: {
        'prettier/prettier': [
            'error',
            { trailingComma: 'es5', singleQuote: true, printWidth: 90, tabWidth: 4 },
        ],

        'import/order': [
            'error',
            {
                groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
            },
        ],
        'no-unused-vars': ['error', { vars: 'all', args: 'none' }],
        'no-underscore-dangle': 'off',
        'no-param-reassign': 'off',
        'no-console': 'off',
        'no-warning-comments': ['warn', { terms: ['fixme'], location: 'start' }],
    },
};
