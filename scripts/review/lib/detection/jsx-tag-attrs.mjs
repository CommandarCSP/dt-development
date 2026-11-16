// JSX 여는 태그 단위 속성 검사 (GEN-23) — 예: onClick 이 붙은 비인터랙티브 요소는 role·tabIndex·onKeyDown 을 모두 갖는다.
// 태그 안의 {…} 식(화살표 함수의 `=>` 포함)을 중괄호 깊이로 건너뛰어 여는 태그의 끝 `>` 를 찾는다.
// Config: { type: 'jsx-tag-attrs', tags: string[], when: regex(태그 텍스트 안), requireAll: regex[], rationale? }

const lineAt = (code, index) => code.slice(0, index).split('\n').length;

function openTagEnd(code, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < code.length; i++) {
    const ch = code[i];
    if (quote) { if (ch === quote && code[i - 1] !== '\\') quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { if (depth > 0 || ch !== '`') quote = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return i;
  }
  return -1;
}

export function detectJsxTagAttrs(code, cfg) {
  const tags = (cfg.tags ?? []).join('|');
  if (!tags || !cfg.when) return [];
  const startRe = new RegExp(`<(${tags})(?=[\\s>/])`, 'g');
  const whenRe = new RegExp(cfg.when);
  const reqs = (cfg.requireAll ?? []).map((s) => ({ src: s, re: new RegExp(s) }));
  const findings = [];
  let m;
  while ((m = startRe.exec(code)) !== null) {
    const end = openTagEnd(code, m.index + 1);
    if (end < 0) break;
    const tag = code.slice(m.index, end + 1);
    if (!whenRe.test(tag)) continue;
    const missing = reqs.filter((r) => !r.re.test(tag)).map((r) => r.src);
    if (missing.length) findings.push({ matched: `<${m[1]}> missing: ${missing.join(' · ')}`, line: lineAt(code, m.index) });
  }
  return findings;
}
