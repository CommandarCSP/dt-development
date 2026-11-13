import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// .dt-frontend.json(또는 stack config)의 `overrides` 객체 키 집합을 반환.
// 파일/overrides 없거나 파싱 실패 시 빈 Set.
export async function loadOverrideKeys(projectRoot, configFileName = '.dt-frontend.json') {
  try {
    const cfg = JSON.parse(await readFile(join(projectRoot, configFileName), 'utf8'));
    if (cfg && cfg.overrides && typeof cfg.overrides === 'object') {
      return new Set(Object.keys(cfg.overrides));
    }
  } catch {
    // no config or parse error → no overrides
  }
  return new Set();
}

// override 근거 — 값이 "PD-NNN" 문자열이거나 { decisionRef: "PD-NNN", ... } 객체면 그 결정을 근거로 본다.
// 그 밖의 값(예: 옛 형식 "mui")은 근거 없음. 정책: docs/policies/TP-001-decision-records.md.
const REF_RE = /^(PD|TP)-\d{3,}$/;
export function decisionRefOf(value) {
  if (typeof value === 'string') return REF_RE.test(value.trim()) ? value.trim() : null;
  if (value && typeof value === 'object' && typeof value.decisionRef === 'string' && value.decisionRef.trim()) return value.decisionRef.trim();
  return null;
}

/** `[{ key, decisionRef }]` — 파일/overrides 없거나 파싱 실패 시 []. */
export async function loadOverrides(projectRoot, configFileName = '.dt-frontend.json') {
  try {
    const cfg = JSON.parse(await readFile(join(projectRoot, configFileName), 'utf8'));
    if (cfg && cfg.overrides && typeof cfg.overrides === 'object') {
      return Object.entries(cfg.overrides).map(([key, value]) => ({ key, decisionRef: decisionRefOf(value) }));
    }
  } catch {
    // no config or parse error → no overrides
  }
  return [];
}

/**
 * override 마다 근거 결정을 확인해 리뷰 finding 으로 바꾼다. 풀 리뷰에서만 쓴다 — 빌더의 Phase 게이트(partial)는
 * 사람 결정을 만들 수 없으니 막지 않는다.
 * 근거 없음·못 찾음·유효하지 않음 → critical, 만료 → important.
 */
export async function overrideDecisionFindings(projectRoot, configFileName = '.dt-frontend.json', opts = {}) {
  const { checkDecisionRef } = await import('../../../../scripts/decisions.mjs');
  const out = [];
  for (const { key, decisionRef } of await loadOverrides(projectRoot, configFileName)) {
    const r = checkDecisionRef(projectRoot, decisionRef, opts);
    if (!r.level) continue;
    out.push({
      severity: r.level === 'error' ? 'critical' : 'important',
      ruleId: 'override-decision-ref',
      file: configFileName,
      message: `overrides.${key}: ${r.message}`,
    });
  }
  return out;
}
