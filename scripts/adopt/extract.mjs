#!/usr/bin/env node
/**
 * dt-adopt 기계 추출 — 결정적으로 뽑을 수 있는 것만 모아 `.dt-adopt/extraction.json` 뼈대를 만든다.
 * 그 위에 adopt-extractor 에이전트가 코드를 읽어 DTO 형태·화면 요소·업무 규칙을 채운다(`agents/adopt-extractor.md`).
 *
 * 모으는 것: 스택 · FE 화면(surfaceInventory) · FE 가 부르는 API · BE 엔드포인트 · FE↔BE 대조 · 수상한 점(의도/버그 확인 후보) · 결정 후보
 * FE·BE 가 다른 저장소면 --fe <root> --be <root> 로 각각 준다. 하나면 <projectRoot> 하나.
 *
 * CLI: node scripts/adopt/extract.mjs [<projectRoot>] [--fe <root>] [--be <root>] [--out <file>] [--json]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { detectStacks } from '../detectStackConfig.mjs';
import { surfaceInventory } from '../surfaceInventory.mjs';
import { beEndpoints, endpointSuspects } from './beEndpoints.mjs';
import { feApiCalls, matchCalls } from './feApiCalls.mjs';
import { decisionCandidates } from './decisionCandidates.mjs';

const pkgOf = (root) => { const p = join(root, 'package.json'); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}; };
const git = (root, args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });

/**
 * 스펙 머리 `<!-- origin: as-built @<ref> -->` 의 ref — 이 스펙이 어느 코드에서 뽑혔나.
 *   git, 깨끗함     → `<sha>`
 *   git, 안 올린 변경 → `<sha>-dirty` (커밋에 없는 코드에서 뽑았다 — 그 커밋으로 돌아가도 같은 코드가 아니다)
 *   git 아님        → `nogit-<YYYY-MM-DD>` (뽑은 날만 남는다 — 다시 adopt 할 때 바뀐 곳을 비교할 기준이 없다)
 * 앞의 둘이 아니면 notice 로 사용자에게 한 줄 알린다.
 */
export function originOf(root, today = new Date().toISOString().slice(0, 10)) {
  const head = git(root, ['rev-parse', '--short', 'HEAD']);
  if (head.status !== 0) return { root, commit: null, ref: `nogit-${today}`, notice: `${root} 은 git 저장소가 아니다(또는 커밋이 없다) — 스펙 출처를 뽑은 날짜로만 남긴다. 나중에 다시 /dt-adopt 할 때 바뀐 곳을 커밋으로 비교할 수 없다` };
  const sha = head.stdout.trim();
  const dirty = (git(root, ['status', '--porcelain']).stdout ?? '').trim().length > 0;
  return dirty
    ? { root, commit: sha, ref: `${sha}-dirty`, notice: `${root} 에 커밋하지 않은 변경이 있다 — 그 변경까지 포함해 뽑는다(출처 ${sha}-dirty). 커밋한 뒤 뽑으면 출처가 정확해진다` }
    : { root, commit: sha, ref: sha, notice: null };
}

export function extract({ fe = null, be = null } = {}) {
  const out = { extractedAt: new Date().toISOString(), origin: {}, notices: [], stacks: [], frontend: null, backend: null, crossCheck: null, suspects: [], decisionCandidates: [] };
  if (fe) {
    out.origin.frontend = originOf(fe);
    out.stacks.push('frontend');
    const surface = surfaceInventory({ projectRoot: fe });
    out.frontend = { router: surface.router, screens: surface.screens, apiCalls: feApiCalls(fe) };
    out.decisionCandidates.push(...decisionCandidates(fe, { stack: 'frontend' }).map((c) => ({ ...c, stack: 'frontend' })));
  }
  if (be) {
    out.origin.backend = originOf(be);
    out.stacks.push('backend');
    const endpoints = beEndpoints(be);
    out.backend = { endpoints };
    out.suspects.push(...endpointSuspects(endpoints));
    out.decisionCandidates.push(...decisionCandidates(be, { stack: 'backend' }).map((c) => ({ ...c, stack: 'backend' })));
  }
  const notices = [...new Set(Object.values(out.origin).map((o) => o.notice).filter(Boolean))];
  out.notices.push(...notices);
  if (out.frontend && out.backend) {
    out.crossCheck = matchCalls(out.frontend.apiCalls, out.backend.endpoints);
    for (const e of out.crossCheck.unusedEndpoints.filter((x) => x.path !== '/')) out.suspects.push({ kind: 'endpoint-without-caller', endpoint: `${e.method} ${e.path}`, evidence: e.evidence, question: 'BE 에 있는데 FE 가 부르지 않는다(짝 없는 능력 — askquestion-principle 예시 A). 화면 스펙이 빠졌나, 다른 클라이언트용인가, 죽은 API 인가?' });
    for (const c of out.crossCheck.unmatchedCalls) out.suspects.push({ kind: 'fe-call-without-endpoint', endpoint: `${c.method} ${c.path}`, evidence: c.evidence, question: 'FE 가 부르는데 BE 에 이 엔드포인트가 없다. 다른 서버(외부 API)인가, BE 에서 빠졌나, FE 가 옛 경로를 부르나?' });
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? resolve(args[i + 1]) : null; };
  let fe = opt('fe');
  let be = opt('be');
  const single = args.find((a, i) => !a.startsWith('--') && !['--fe', '--be', '--out'].includes(args[i - 1]));
  if (single && !fe && !be) {
    const root = resolve(single);
    const stacks = detectStacks(pkgOf(root));
    if (stacks.includes('frontend')) fe = root;
    if (stacks.includes('backend')) be = root;
  }
  const r = extract({ fe, be });
  const outPath = opt('out') ?? join(single ? resolve(single) : (fe ?? be ?? '.'), '.dt-adopt/extraction.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(r, null, 2) + '\n');
  if (args.includes('--json')) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  else process.stdout.write(`${outPath} — 화면 ${r.frontend?.screens.length ?? 0} · FE 호출 ${r.frontend?.apiCalls.length ?? 0} · BE 엔드포인트 ${r.backend?.endpoints.length ?? 0} · 확인 후보 ${r.suspects.length} · 결정 후보 ${r.decisionCandidates.length}\n`);
  for (const n of r.notices) process.stdout.write(`! ${n}\n`);
}
