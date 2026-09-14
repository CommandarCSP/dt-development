// Detects a forbidden regex pattern in raw source code.
// Config: { type: 'forbidden-pattern', pattern: string, flags?: string, rationale?: string }
//
// Returns one finding per match with line number.

export function detectForbiddenPattern(code, cfg) {
  const patternStr = cfg.pattern;
  if (!patternStr) return [];

  let re;
  try {
    const flags = cfg.flags && /^[gimsuy]+$/.test(cfg.flags) ? cfg.flags : 'g';
    re = new RegExp(patternStr, flags.includes('g') ? flags : flags + 'g');
  } catch {
    return [{ manualReview: true, hint: `invalid forbidden-pattern regex: ${patternStr}` }];
  }

  const findings = [];
  let m;
  while ((m = re.exec(code)) !== null) {
    const line = code.slice(0, m.index).split('\n').length;
    findings.push({ matched: m[0], line });
    if (m.index === re.lastIndex) re.lastIndex++; // avoid zero-width loop
  }
  return findings;
}
