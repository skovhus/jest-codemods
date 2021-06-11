import execa from 'execa'
import path from 'path'

export const transformerDirectory = path.join(__dirname, '../', 'transformers')
export const jscodeshiftExecutable = require.resolve('jscodeshift/bin/jscodeshift.js')

type Flags = {
  dry?: boolean
}

type Files = string | string[]

export type Parser = 'babel' | 'flow' | 'ts' | 'tsx'

function executeTransformation({
  files,
  flags,
  parser,
  transformer,
  transformerArgs,
}: {
  files: Files
  flags: Flags
  parser: Parser
  transformer: string
  transformerArgs?: string[]
}) {
  const transformerPath = path.join(transformerDirectory, `${transformer}.js`)

  let args = ['-t', transformerPath].concat(files)

  const { dry } = flags

  if (dry) {
    args.push('--dry')
  }

  args.push('--ignore-pattern', 'node_modules')

  args.push('--parser', parser)
  if (parser === 'tsx') {
    args.push('--extensions=tsx,ts')
  } else if (parser === 'ts') {
    args.push('--extensions=ts')
  }

  if (transformerArgs && transformerArgs.length > 0) {
    args = args.concat(transformerArgs)
  }

  console.log(`Executing command: jscodeshift ${args.join(' ')}`)

  const result = execa.sync('node', [jscodeshiftExecutable, ...args], {
    stdio: 'inherit',
    stripFinalNewline: false,
  })

  if (result.stderr) {
    throw result.stderr
  }
}

export function executeTransformations({
  files,
  flags,
  parser,
  transformers,
  transformerArgs = [],
}: {
  files: Files
  flags: Flags
  parser: Parser
  transformers: string[]
  transformerArgs?: string[]
}) {
  transformers.forEach((t) => {
    executeTransformation({
      files,
      flags,
      transformer: t,
      parser,
      transformerArgs,
    })
  })
}
