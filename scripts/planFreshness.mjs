#!/usr/bin/env node
/**
 * plan.md 가 최신인가 — "plan 이 최신이면 생략"의 기준(GEN-24). 에이전트 판단 대신 내용 해시로 정한다.
 *
 * 기준 해시 = 그 유닛 스펙 파일들(+ interactions.md 의 자기 스택 절) 본문을 specContentHash 로 이은 것.
 *   - FE: docs/specs/pages/<unit>/{requirements,design,tasks,layout-skeleton}.md + interactions `## FE 크로스페이지`
 *   - BE: docs/specs/resources/<unit>/{requirements,design,tasks,api-contract}.md + interactions `## BE 크로스리소스`
 * HTML 주석·공백은 해시에서 빠진다(specContentHash) — 주석·줄바꿈만 바뀐 스펙은 플랜을 다시 만들지 않는다.
 * plan.md 머리 줄 `> 출처 스펙: … · specHash: <8자>` 와 비교한다.
 *
 * CLI: node scripts/planFreshness.mjs <unitDir> [--json]  → fresh | stale | missing  (fresh 면 exit 0, 아니면 1)
 *      node scripts/planFreshness.mjs <unitDir> --hash    → 현재 기준 해시만 출력(plan-author 가 머리에 적는다)
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { specContentHash } from './specContentHash.mjs';
import { parseSections } from './lib/sections.mjs';

const FILES = { pages: ['requirements', 'design', 'tasks', 'layout-skeleton'], resources: ['requirements', 'design', 'tasks', 'api-contract'] };
const OWN = { pages: 'FE 크로스페이지', resources: 'BE 크로스리소스' };

export function unitSpecHash(unitDir) {
  const kind = basename(dirname(unitDir));
  if (!FILES[kind]) throw new Error(`unitDir 는 docs/specs/pages/<unit> 또는 docs/specs/resources/<unit> 이어야 한다: ${unitDir}`);
  const parts = FILES[kind].map((f) => {
    const p = join(unitDir, `${f}.md`);
    return `${f}:${existsSync(p) ? specContentHash(readFileSync(p, 'utf8')) : '-'}`;
  });
  const inter = join(dirname(dirname(unitDir)), 'interactions.md');
  const own = existsSync(inter) ? parseSections(readFileSync(inter, 'utf8')).sections.find((s) => s.key === OWN[kind]) : null;
  parts.push(`interactions:${own ? specContentHash(own.text) : '-'}`);
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 8);
}

export function planFreshness(unitDir) {
  const plan = join(unitDir, 'plan.md');
  const current = unitSpecHash(unitDir);
  if (!existsSync(plan)) return { state: 'missing', current, recorded: null };
  const recorded = readFileSync(plan, 'utf8').match(/specHash:\s*([0-9a-f]{8})/)?.[1] ?? null;
  return { state: recorded === current ? 'fresh' : 'stale', current, recorded };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const dir = resolve(args.find((a) => !a.startsWith('--')) ?? '.');
  if (args.includes('--hash')) { process.stdout.write(unitSpecHash(dir) + '\n'); process.exit(0); }
  const r = planFreshness(dir);
  process.stdout.write(args.includes('--json') ? JSON.stringify(r) + '\n' : `${r.state} (기록 ${r.recorded ?? '없음'} · 현재 ${r.current})\n`);
  process.exit(r.state === 'fresh' ? 0 : 1);
}
