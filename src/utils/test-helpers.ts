import jscodeshift from 'jscodeshift'

// simulate the jscodeshift api
export function api(options): jscodeshift.API {
  let j = jscodeshift

  if (options.parser) {
    j = j.withParser(options.parser)
  }

  return {
    jscodeshift: j,
    j,
    stats: () => {},
    report: () => {},
  }
}

export function runPlugin(plugin: jscodeshift.Transform, source: string, options = {}) {
  return plugin({ source, path: 'test.js' }, api(options), options)
}

export function wrapPlugin(plugin: jscodeshift.Transform) {
  return (source: string, options = {}) => runPlugin(plugin, source, options) || null
}
