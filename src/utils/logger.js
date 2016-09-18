const warnings = new Set();

/**
 * Logs the given warning once.
 */
export default function logWarning(fileInfo, msg, node) {
    if (warnings.has(msg)) {
        return;
    }
    console.warn(`jest-codemods warning: (${fileInfo.path} line ${node.value.loc.start.line}) ${msg}`);
    warnings.add(msg);
}
