/**
 * Logs the given warning.
 */
export default function logWarning(fileInfo, msg, node) {
    const lineInfo = node ? ` line ${node.value.loc.start.line}` : '';
    console.warn(`jest-codemods warning: (${fileInfo.path}${lineInfo}) ${msg}`);
}
