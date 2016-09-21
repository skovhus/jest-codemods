module.exports = {
    extends: 'airbnb-base',
    env: {
        'node': true,
    },
    root: true,
    rules: {
        'arrow-parens': ['error', 'as-needed'],
        'comma-dangle': ['error', 'always-multiline'],
        'import/order': ['error', {
             'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        }],
        'indent': ['error', 4, {'SwitchCase': 1}],
        'max-len': ['error', 200, 4, {'ignoreComments': true, 'ignoreUrls': true}],
        'no-unused-vars': ['error', {'vars': 'all', 'args': 'none'}],
        'space-before-function-paren': ['error', 'never'],
        'space-in-parens': ['error', 'never'],
        'no-underscore-dangle': 'off',
        'no-param-reassign': 'off',
        'no-console': 'off',
        'no-warning-comments': ['warn', { 'terms': ['fixme'], 'location': 'start' }],
    }
}
