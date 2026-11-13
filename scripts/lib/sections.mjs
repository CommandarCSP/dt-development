/**
 * 마크다운 `## 절` 단위 병합 — 여러 스킬이 한 파일을 함께 쓸 때, 각자 자기 절만 바꾸게 한다.
 * 쓰는 곳: `scripts/projectContextSync.mjs`(project-context.md), `scripts/interactionsSync.mjs`(interactions.md).
 * 누가 어느 절을 쓰는지는 `docs/refs/artifact-contract.md` 가 정한다.
 */

/** "프로젝트 기술/라이브러리 (전역 세트 외 추가)" → "프로젝트 기술/라이브러리" */
export const sectionKey = (title) => title.replace(/\s*\([^)]*\)\s*$/, '').trim();

/** `{ preamble, sections: [{ key, text }] }` — text 는 `## 제목` 줄부터 다음 `## ` 직전까지(그대로). */
export function parseSections(md) {
  const parts = md.split(/^(?=## )/m);
  const preamble = parts[0].startsWith('## ') ? '' : parts.shift();
  return {
    preamble,
    sections: parts.map((text) => {
      const nl = text.indexOf('\n');
      return { key: sectionKey(text.slice(3, nl < 0 ? undefined : nl)), text };
    }),
  };
}

const ensureNl = (s) => (s.endsWith('\n') ? s : s + '\n');
export const renderSections = ({ preamble, sections }) =>
  preamble + sections.map((s, i) => (i < sections.length - 1 ? ensureNl(s.text).replace(/\n*$/, '\n\n') : s.text)).join('');

/**
 * `rendered` 의 절을 `existing` 에 합친다.
 * - owned: 바꾼다(없으면 order 순서 자리에 넣는다)
 * - fillIfAbsent: existing 에 없을 때만 넣는다(사용자 편집 보존)
 * - 그 밖의 절: existing 그대로
 * - 머리(preamble): rendered 것이 있으면 그것, 없으면 existing 것
 */
export function mergeOwnedSections(existing, rendered, { owned = [], fillIfAbsent = [], order = [] } = {}) {
  if (!existing || !existing.trim()) return rendered;
  const ex = parseSections(existing);
  const nw = parseSections(rendered);
  const own = new Set(owned);
  const fill = new Set(fillIfAbsent);
  const sections = [...ex.sections];
  const insert = (s) => {
    const rank = order.indexOf(s.key);
    const at = rank < 0 ? -1 : sections.findIndex((x) => order.indexOf(x.key) > rank);
    sections.splice(at < 0 ? sections.length : at, 0, s);
  };
  for (const s of nw.sections) {
    const at = sections.findIndex((x) => x.key === s.key);
    if (own.has(s.key)) { if (at >= 0) sections[at] = s; else insert(s); }
    else if (fill.has(s.key) && at < 0) insert(s);
  }
  return renderSections({ preamble: nw.preamble || ex.preamble, sections });
}
