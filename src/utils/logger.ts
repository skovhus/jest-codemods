import chalk from 'chalk'

export function logWarning(fileInfo, msg: string, node?: any) {
  // If the node has been previously modified by the codemod (for instance, when using
  // destructuring) the node doesn't have a loc anymore
  const lineInfo = node && node.value.loc ? ` line ${node.value.loc.start.line}` : ''
  console.warn(chalk.red(`jest-codemods warning: (${fileInfo.path}${lineInfo}) ${msg}`))
}

export function getLogWarningForFile(fileInfo) {
  return (msg: string, node?: any) => logWarning(fileInfo, msg, node)
}
