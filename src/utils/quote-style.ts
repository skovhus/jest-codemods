/**
 * As Recast is not preserving original quoting, we try to detect it.
 * See https://github.com/benjamn/recast/issues/171
 * and https://github.com/facebook/jscodeshift/issues/143
 * @return 'double', 'single' or null
 */
export default function detectQuoteStyle(j, ast) {
  let doubles = 0
  let singles = 0

  ast
    .find(j.Literal, {
      value: v => typeof v === 'string',
      raw: v => typeof v === 'string',
    })
    .forEach(p => {
      // The raw value is from the original babel source
      const quote = p.value.raw[0]
      if (quote === '"') {
        doubles += 1
      }
      if (quote === "'") {
        singles += 1
      }
    })

  if (doubles === singles) {
    return null
  }
  return doubles > singles ? 'double' : 'single'
}
