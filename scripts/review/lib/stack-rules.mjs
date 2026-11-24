// 규칙 읽기 + 프로젝트에 맞추기 — 리뷰 두 모드가 함께 쓴다.
// 순서: 규칙 파일 → BE 스택 어댑터 빈칸 채우기(GEN-05, scripts/stackAdapters.mjs) → 폴더·테스트 이름 바꾸기(GEN-04·06, layout.mjs).
// 어댑터가 먼저다 — 채워진 `src/...` 경로도 layout 이 바꿔야 한다.
import { loadAllRules } from './rule-loader.mjs';
import { applyLayout, readConfig } from './layout.mjs';
import { resolveBackendStack, applyStackAdapters } from '../../stackAdapters.mjs';

/** @returns {{ rules: object[], stackInfo: null | { describe: string, notes: string[], skipped: {ruleId,area}[], stack: object } }} */
export async function loadStackRules({ pluginRoot, projectRoot, ruleLocations, configFileName, stack }) {
  const cfg = await readConfig(projectRoot, configFileName);
  let rules = await loadAllRules(pluginRoot, ruleLocations);
  let stackInfo = null;
  if (stack === 'backend') {
    const st = resolveBackendStack(projectRoot, cfg);
    const r = applyStackAdapters(rules, st);
    rules = r.rules;
    stackInfo = { describe: st.describe, notes: st.notes, skipped: r.skipped, stack: st };
  }
  return { rules: applyLayout(rules, cfg), stackInfo };
}
