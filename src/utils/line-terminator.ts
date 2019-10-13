/**
 * By default, Recast uses the line terminator of the OS the code runs on.
 * This is often not desired, so we instead try to detect it from the input.
 * If there is at least one Windows-style linebreak (CRLF) in the input, use that.
 * In all other cases, use Unix-style (LF).
 * @return '\n' or '\r\n'
 */
export default function detectLineTerminator(source) {
  return source && source.includes('\r\n') ? '\r\n' : '\n'
}
