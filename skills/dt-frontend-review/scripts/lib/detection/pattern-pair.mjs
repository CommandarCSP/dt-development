// 파일 단위 패턴 짝 — "A 가 있으면 B 도 있어야 한다 / C 는 없어야 한다" (GEN-23).
// AST 파서 없이(플러그인은 의존성 없이 돈다) 잡을 수 있는 구조 위반용이다.
// Config: { type: 'pattern-pair', when?: regex, require?: regex, requireAll?: regex[], forbid?: regex, flags?: 'm'|'s'|… , rationale? }
//   - when 이 있으면 when 이 맞는 파일만 본다(없으면 모든 파일).
//   - forbid 가 맞으면 그 줄에서 위반.
//   - require 가 안 맞거나 requireAll 중 하나라도 안 맞으면 when 의 첫 줄(없으면 1행)에서 위반.

const re = (src, flags) => new RegExp(src, flags);
const lineAt = (code, index) => code.slice(0, index).split('\n').length;

export function detectPatternPair(code, cfg) {
  const flags = (cfg.flags && /^[imsu]+$/.test(cfg.flags) ? cfg.flags : 'm');
  let whenRe, forbidRe, requireRe, requireAll;
  try {
    whenRe = cfg.when ? re(cfg.when, flags) : null;
    forbidRe = cfg.forbid ? re(cfg.forbid, flags + 'g') : null;
    requireRe = cfg.require ? re(cfg.require, flags) : null;
    requireAll = (cfg.requireAll ?? []).map((s) => ({ src: s, re: re(s, flags) }));
  } catch (e) {
    return [{ manualReview: true, hint: `invalid pattern-pair regex: ${e.message}` }];
  }
  const when = whenRe ? code.match(whenRe) : null;
  if (whenRe && !when) return [];
  const anchor = when ? lineAt(code, code.search(whenRe)) : 1;
  const findings = [];
  if (forbidRe) {
    let m;
    while ((m = forbidRe.exec(code)) !== null) {
      findings.push({ matched: m[0], line: lineAt(code, m.index) });
      if (m.index === forbidRe.lastIndex) forbidRe.lastIndex++;
    }
  }
  if (requireRe && !requireRe.test(code)) findings.push({ matched: `missing: ${cfg.require}`, line: anchor });
  const missing = requireAll.filter((r) => !r.re.test(code)).map((r) => r.src);
  if (missing.length) findings.push({ matched: `missing: ${missing.join(' · ')}`, line: anchor });
  return findings;
}
