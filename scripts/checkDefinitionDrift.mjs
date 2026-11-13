#!/usr/bin/env node
/**
 * 정의서 정합 게이트(구조) — 확정 직전에 산출물 계약이 정의서 IF 와 어긋난 채 남았는지 기계로 확인한다.
 * 절차·의미 판단(응답 shape·정렬 규칙 등)은 `docs/refs/upward-alignment.md` "최종 정합 게이트"가 정하고 작성 에이전트가 한다.
 * 이 스크립트는 그중 **구조로 확인할 수 있는 것**만 강제한다 — 에이전트가 건너뛰어도 확정이 막히게.
 *
 * 대상
 *   - BE api-contract.md: 엔드포인트 행의 `<!-- from: IF-n -->` → 정의서에 IF-n 이 있는가, 메서드·경로가 같은가
 *                         (`detectDrift` 로 메서드 비교). from 이 없는 행 = 정의서에 없는 새 엔드포인트.
 *   - FE/BE 스펙 공통: 본문 `<!-- from: IF-n -->`·머리 `basedOnDefinition … | IF-a,IF-b` 가 가리키는 IF 가 정의서에 있는가.
 * 명시적으로 큐잉한 항목(`<!-- conflict: IF-n -->`)과 미해소로 건너뛴 항목(`<!-- skipped: IF-n … -->`)은 드리프트로 세지 않는다.
 *
 * CLI: node scripts/checkDefinitionDrift.mjs <definition.md> <spec.md…> [--json]   — 미반영 드리프트가 있으면 exit 1
 */
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectDrift } from './definitionPropagation.mjs';

const METHOD_PATH_RE = /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s|`]*)/;
const normPath = (p) => p.replace(/:([A-Za-z_]\w*)/g, '{$1}').replace(/\/+$/, '') || '/';

/** 정의서 IF 행 → Map(IF-n → { method, path, row }) */
export function parseDefinitionIFs(md) {
  const out = new Map();
  for (const row of md.match(/^\s*\|\s*IF-\d+\s*\|.*$/gm) ?? []) {
    const id = row.match(/IF-\d+/)[0];
    const mp = row.match(METHOD_PATH_RE);
    out.set(id, { method: mp?.[1] ?? null, path: mp ? normPath(mp[2]) : null, row: row.trim() });
  }
  return out;
}

const markedIds = (text, kind) => new Set([...text.matchAll(new RegExp(`<!--\\s*${kind}:\\s*(IF-\\d+)`, 'g'))].map((m) => m[1]));

/**
 * @returns {{ drift: { id: string|null, kind: string, detail: string }[], checked: number }}
 */
export function checkDrift(definitionMd, specMd, { kind = 'spec' } = {}) {
  const ifs = parseDefinitionIFs(definitionMd);
  const queued = markedIds(specMd, 'conflict');
  const skipped = markedIds(specMd, 'skipped');
  const ok = (id) => queued.has(id) || skipped.has(id);
  const drift = [];

  // 참조 무결성 — 본문 from: IF-n, 머리 basedOnDefinition 의 IF 목록
  const refs = new Set([...specMd.matchAll(/<!--\s*from:\s*(IF-\d+)/g)].map((m) => m[1]));
  const head = specMd.match(/<!--\s*basedOnDefinition:[^|>]*\|\s*([^>]*?)\s*-->/);
  if (head) for (const id of head[1].split(/[,\s]+/).filter((x) => /^IF-\d+$/.test(x))) refs.add(id);
  for (const id of refs) if (!ifs.has(id) && !ok(id)) drift.push({ id, kind: 'missing-if', detail: `${id} 를 가리키지만 정의서에 없다` });

  let checked = 0;
  if (kind === 'api-contract') {
    for (const row of specMd.match(/^\|\s*(GET|POST|PUT|PATCH|DELETE)\s*\|.*$/gm) ?? []) {
      checked++;
      const cells = row.split('|').slice(1, -1).map((c) => c.trim().replace(/`/g, ''));
      const method = cells[0];
      const path = normPath(cells[1] ?? '');
      const from = row.match(/<!--\s*from:\s*(IF-\d+)/)?.[1];
      if (!from) { drift.push({ id: null, kind: 'new-endpoint', detail: `${method} ${path} 는 정의서 IF 를 가리키지 않는다(<!-- from: IF-n --> 없음) — 정의서에 IF 를 추가(T2)하거나 큐잉한다` }); continue; }
      const def = ifs.get(from);
      if (!def || ok(from)) continue;
      const { conflicting } = detectDrift({ method: def.method ?? undefined }, { method });
      for (const c of conflicting) drift.push({ id: from, kind: 'method', detail: `${from}: ${c}` });
      if (def.path && def.path !== path) drift.push({ id: from, kind: 'path', detail: `${from}: 경로 ${def.path} ≠ ${path}` });
    }
  }
  return { drift, checked };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const [defPath, ...specs] = args.filter((a) => !a.startsWith('--'));
  const definition = readFileSync(defPath, 'utf8');
  const results = specs.map((p) => ({ path: p, ...checkDrift(definition, readFileSync(p, 'utf8'), { kind: basename(p) === 'api-contract.md' ? 'api-contract' : 'spec' }) }));
  if (args.includes('--json')) process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  else for (const r of results) {
    process.stdout.write(`${r.path} — 미반영 드리프트 ${r.drift.length}건\n`);
    for (const d of r.drift) process.stdout.write(`  ✗ [${d.kind}] ${d.detail}\n`);
  }
  process.exit(results.some((r) => r.drift.length) ? 1 : 0);
}
