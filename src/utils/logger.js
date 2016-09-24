import chalk from 'chalk';

export default function logWarning(fileInfo, msg, node) {
    const lineInfo = node ? ` line ${node.value.loc.start.line}` : '';
    console.warn(chalk.red(`jest-codemods warning: (${fileInfo.path}${lineInfo}) ${msg}`));
}
