const warnings = new Set();

/**
 * Logs the given warning once.
 */
export default function logWarning(fileInfo, msg, node) {
    if (warnings.has(msg)) {
        return;
    }
    const lineInfo = node ? ` line ${node.value.loc.start.line}` : '';
    console.warn(`jest-codemods warning: (${fileInfo.path}${lineInfo}) ${msg}`);
    warnings.add(msg);
}
