import jscodeshift from 'jscodeshift'

// simulate the jscodeshift api
export function api(): jscodeshift.API {
  return {
    jscodeshift,
    j: jscodeshift,
    stats: () => {},
    report: () => {},
  }
}

export function runPlugin(plugin: jscodeshift.Transform, source: string, options = {}) {
  return plugin({ source, path: 'test.js' }, api(), options)
}

export function wrapPlugin(plugin: jscodeshift.Transform) {
  return (source: string, options = {}) => runPlugin(plugin, source, options) || null
}
