import { matchAny } from '../matcher.mjs';

// Detect bare or member function calls.
// cfg = { matches: ['useQuery', 'vi.mock', ...], matchArguments?: ['**/foo/**'] }
// If matchArguments provided, only flag when first string argument matches one of those patterns.

export function detectForbiddenCall(code, cfg) {
  const findings = [];
  const matches = cfg.matches || [];
  const argFilter = cfg.matchArguments;
  const lines = code.split('\n');

  for (const callName of matches) {
    const escapedName = escapeRe(callName);
    // Match callName( preceded by non-identifier chars (or start of string)
    // Capture optional first string argument
    const re = new RegExp(`(?:^|[^a-zA-Z0-9_$])${escapedName}\\s*\\(\\s*(?:['"]([^'"]*)['"])?`, 'gm');
    let m;
    while ((m = re.exec(code)) !== null) {
      // Determine which line the match is on
      const matchOffset = m.index;
      // Determine line of the actual call name (skip leading non-identifier prefix char)
      const prefixChar = m[0][0];
      // If the first captured char is a non-identifier (lookbehind substitute), the
      // actual call starts one char later. If that char is '\n', the call is on the next line.
      const callOffset = (prefixChar && !/[a-zA-Z0-9_$]/.test(prefixChar))
        ? matchOffset + 1
        : matchOffset;
      const linesBefore = code.slice(0, callOffset).split('\n');
      const lineIndex = linesBefore.length - 1;
      const lineText = lines[lineIndex] || '';

      // Skip if this line is an import statement (has 'import' keyword + quotes around source)
      if (/\bimport\b/.test(lineText) && /from\s+['"]/.test(lineText)) continue;
      // Also skip re-export lines
      if (/\bexport\b/.test(lineText) && /from\s+['"]/.test(lineText)) continue;

      const firstArg = m[1]; // may be undefined if no string arg captured
      if (argFilter) {
        if (!firstArg) continue;
        if (!matchAny(firstArg, argFilter)) continue;
      }

      findings.push({ matched: callName, line: lineIndex + 1, argument: firstArg });
    }
  }
  return findings;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
