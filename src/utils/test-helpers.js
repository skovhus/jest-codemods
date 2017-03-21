import jscodeshift from 'jscodeshift';

// simulate the jscodeshift api
export function api() {
    return {
        jscodeshift,
        stats: () => {},
    };
}

export function runPlugin(plugin, source, options = {}) {
    return plugin({ source, path: 'test.js' }, api(), options);
}

export function wrapPlugin(plugin) {
    return (source, options) => runPlugin(plugin, source, options);
}
