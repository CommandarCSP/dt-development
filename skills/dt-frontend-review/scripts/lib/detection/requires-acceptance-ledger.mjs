// Advisory (minor): flags spec directories that have a spec but no acceptance e2e ledger.
// Semantics: scan `<projectRoot>/<specsDir>/*/` — a dir with `requirements.md` (spec exists)
// but no `*.e2e-scenarios.md` (acceptance ledger missing) yields a finding.
// Config: { type: 'requires-acceptance-ledger', specsDir?: string, nudge?: string, description?: string }
//   - specsDir: 스캔 루트(기본 'docs/specs/pages'). BE 룰은 'docs/specs/resources' 지정.
//   - nudge: finding 메시지의 권장 명령(기본 '/dt-e2e'). BE 룰은 '/dt-be-e2e'.
//
// Why spec dirs (not the page .tsx file): 페이지 파일명 ↔ 원장명은 기계 매핑이 불가하다
// (예: FeedPostDetailPage.tsx ↔ feed-detail.e2e-scenarios.md). 스펙 디렉토리는 확정된 검사 단위다.
//
// Dedupe: 이 룰은 appliesTo(src/pages/**/*.tsx)로 여러 페이지 파일마다 호출되지만 finding은
// 스펙 디렉토리에 종속(변경 파일과 무관)이라 호출마다 같은 finding이 중복될 수 있다.
//   - 단일 호출 내부: 디렉토리명을 정렬·중복제거해 한 번씩만 낸다.
//   - 호출 간(run 전체): ctx.cache(엔진이 run당 1개 생성해 주입하는 공유 객체)에 보고한 디렉토리를
//     기록해 이미 보고된 건 건너뛴다. 모듈 스코프 캐시는 테스트 격리를 깨므로 쓰지 않는다.
//     ctx.cache가 없으면(직접 호출 등) 단일-호출 dedupe만 적용된다.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function detectRequiresAcceptanceLedger(_code, cfg, ctx) {
  if (!ctx?.projectRoot) {
    return [{ manualReview: true, hint: 'requires-acceptance-ledger needs projectRoot (internal error)' }];
  }
  const specsDir = cfg?.specsDir || 'docs/specs/pages';   // BE 룰은 docs/specs/resources로 지정
  const nudge = cfg?.nudge || '/dt-e2e';                   // BE 룰은 /dt-be-e2e
  const specsRoot = join(ctx.projectRoot, specsDir);
  if (!existsSync(specsRoot)) return [];

  let dirs;
  try {
    dirs = readdirSync(specsRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort(); // 정렬 → 결정적 순서 + 단일-호출 dedupe
  } catch {
    return [];
  }

  // run 전체 dedupe용 공유 캐시(엔진 주입). 없으면 단일-호출 dedupe만.
  const reported = ctx.cache && (ctx.cache.acceptanceLedger ||= new Set());

  const findings = [];
  for (const dir of dirs) {
    const dirAbs = join(specsRoot, dir);
    let entries;
    try {
      entries = readdirSync(dirAbs);
    } catch {
      continue;
    }
    const hasSpec = entries.includes('requirements.md');
    if (!hasSpec) continue; // 스펙 자체가 없으면 대상 아님
    const hasLedger = entries.some((f) => f.endsWith('.e2e-scenarios.md'));
    if (hasLedger) continue;

    if (reported) {
      const key = `${specsDir}:${dir}`;                    // FE/BE 캐시 키 분리
      if (reported.has(key)) continue;
      reported.add(key);
    }
    findings.push({
      line: 1,
      matched: `수용 e2e 원장 없음: ${specsDir}/${dir}/ (스펙은 있음) — ${nudge} 실행 권장`,
    });
  }
  return findings;
}
