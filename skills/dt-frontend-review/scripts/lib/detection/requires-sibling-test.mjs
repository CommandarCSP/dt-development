// Verifies a sibling test file exists for the inspected source file.
// Config: { type: 'requires-sibling-test', testPath?: string, rationale?: string }
// testPath template tokens: {basename} = file basename without extension.
// Default template: "__tests__/{basename}.test.ts"
//
// 다음 후보를 모두 확인(하나라도 존재하면 통과). suffix × 위치 조합:
//   suffix:  {b}.test / .unit.test / .integration.test (FE 컨벤션)
//            + {b}.spec / .unit.spec / .integration.spec / .e2e-spec (NestJS/jest 컨벤션)
//   위치:    __tests__/ 하위(tmpl 기본) + 콜로케이트(형제, NestJS 관행)
//   확장자:  .ts / .tsx
// (파일럿 발견: NestJS는 *.spec.ts를 형제로 두는데 .test.+__tests__만 보면 false-positive.)
//
// Returns one finding if the sibling test is missing.

import { existsSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';

export function detectRequiresSiblingTest(_code, cfg, ctx) {
  if (!ctx?.relPath || !ctx?.projectRoot) {
    return [{ manualReview: true, hint: 'requires-sibling-test needs file context (internal error)' }];
  }
  const dir = dirname(ctx.relPath);
  const base = basename(ctx.relPath, extname(ctx.relPath));
  const tmpl = cfg.testPath || '__tests__/{basename}.test.ts';

  // suffix 변형(.test / .spec 계열) × 위치(tmpl 기본 __tests__/ + 콜로케이트 형제)
  const suffixes = [
    '.test.', '.unit.test.', '.integration.test.',
    '.spec.', '.unit.spec.', '.integration.spec.', '.e2e-spec.',
  ];
  const expand = (relWithTest) => suffixes.map((s) => relWithTest.replace(/\.test\./, s));

  const candidates = new Set();
  const baseTestRel = join(dir, tmpl.replace('{basename}', base)); // tmpl 기반(기본 __tests__/{basename}.test.ts)
  for (const v of expand(baseTestRel)) candidates.add(v);
  for (const v of expand(join(dir, `${base}.test.ts`))) candidates.add(v); // 콜로케이트(형제) — NestJS *.spec.ts

  // 각 후보를 .ts / .tsx 두 가지 확장자로 확인
  for (const rel of candidates) {
    const abs = join(ctx.projectRoot, rel);
    if (existsSync(abs)) return [];
    const tsxAlt = abs.replace(/\.ts$/, '.tsx');
    if (existsSync(tsxAlt)) return [];
  }

  return [
    {
      matched: baseTestRel,
      line: 1,
      hint: `sibling test missing: ${baseTestRel} (or .unit/.integration/.spec/.e2e-spec variant, __tests__/ or colocated)`,
    },
  ];
}
