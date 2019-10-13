import jscodeshift from 'jscodeshift';

// simulate the jscodeshift api
export function api() {
    return {
        jscodeshift,
        stats: () => {},
    };
}

export function runPlugin(plugin: jscodeshift.Transform, source: string, options = {}) {
    return plugin({ source, path: 'test.js' }, api(), options);
}

export function wrapPlugin(plugin: jscodeshift.Transform) {
    return (source: string, options = {}) => runPlugin(plugin, source, options);
}
