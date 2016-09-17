import jscodeshift from 'jscodeshift';

// simulate the jscodeshift api
export function api() {
    return {
        jscodeshift,
        stats: () => {},
    };
}

export function runPlugin(plugin, source) {
    return plugin({ source, path: 'test.js' }, api());
}

export function wrapPlugin(plugin) {
    return source => runPlugin(plugin, source);
}
