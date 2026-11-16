import { matchAny } from '../matcher.mjs';

// Regex to find import sources (ES module static imports + dynamic import())
// Group 1: the import source string
const IMPORT_RE = /(?:^|\n)\s*(?:import\s+(?:[^'"]*from\s+)?|export\s+[^'"]*from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
const DYN_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export function detectForbiddenImport(code, cfgOrPatterns) {
  // Backward compatible: accepts either an array of patterns or a config object
  // { matches: string[], excludePatterns?: string[] }
  const forbiddenPatterns = Array.isArray(cfgOrPatterns)
    ? cfgOrPatterns
    : cfgOrPatterns?.matches || [];
  const excludePatterns = Array.isArray(cfgOrPatterns)
    ? []
    : cfgOrPatterns?.excludePatterns || [];
  const findings = [];
  const sources = [];
  let m;

  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(code)) !== null) {
    const source = m[1];
    const offset = m.index + m[0].lastIndexOf(source);
    sources.push({ source, offset });
  }

  DYN_IMPORT_RE.lastIndex = 0;
  while ((m = DYN_IMPORT_RE.exec(code)) !== null) {
    const source = m[1];
    const offset = m.index + m[0].lastIndexOf(source);
    // Avoid duplicates from IMPORT_RE already catching static imports
    const alreadyCaptured = sources.some((s) => s.source === source && Math.abs(s.offset - offset) < 5);
    if (!alreadyCaptured) {
      sources.push({ source, offset });
    }
  }

  for (const { source, offset } of sources) {
    if (matchAny(source, forbiddenPatterns) && !matchAny(source, excludePatterns)) {
      const line = code.slice(0, offset).split('\n').length;
      findings.push({ matched: source, line });
    }
  }
  return findings;
}
