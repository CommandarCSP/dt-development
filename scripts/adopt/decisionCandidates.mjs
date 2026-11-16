#!/usr/bin/env node
/**
 * 결정 후보(PD 초안 재료) 수집 — 이미 있는 프로젝트에서 "계속 걸리는 선택"의 흔적을 결정적으로 찾는다(dt-adopt 7단계).
 * 후보는 확정이 아니다. 조율자가 사람에게 보이고, 채택하는 것만 dt-decision 으로 PD 를 쓴다(원칙 9).
 *
 * 근거 종류
 *   - 스택: stackPrecheck 의 adaptable·blocking 영역(플러그인 기본과 다른 기술) → topic stack.*
 *   - 데이터 모델: prisma/schema.prisma 의 반복 패턴(ID 생성 방식, soft delete, 테이블 이름 매핑)
 *   - API: 전역 prefix, 전역 예외 필터(에러 응답 형식)
 *   - 커밋: 메시지에 결정·채택·decision·ADR 이 든 커밋
 * 항목: { topic, title, decision, evidence: ["파일:줄" | "commit <sha> <제목>"], confidence: 'code' | 'doc' | 'guess' }
 *
 * CLI: node scripts/adopt/decisionCandidates.mjs <projectRoot> [--stack frontend|backend] [--json]
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { precheckProject } from '../stackPrecheck.mjs';
import { detectStacks } from '../detectStackConfig.mjs';
import { globalPrefix } from './beEndpoints.mjs';
import { walkSourceFiles } from '../surfaceInventory.mjs';

const lineOf = (text, re) => { const i = text.search(re); return i < 0 ? null : text.slice(0, i).split('\n').length; };

export function prismaCandidates(schema, file = 'prisma/schema.prisma') {
  const out = [];
  const models = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)].map((m) => ({ name: m[1], body: m[2], line: schema.slice(0, m.index).split('\n').length }));
  if (!models.length) return out;
  const idKinds = models.map((m) => m.body.match(/@id\s+@default\((\w+)\(/)?.[1]).filter(Boolean);
  if (idKinds.length >= 2) {
    const counts = idKinds.reduce((a, k) => ({ ...a, [k]: (a[k] ?? 0) + 1 }), {});
    const [kind, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    out.push({ topic: 'data.idStrategy', title: `ID 생성 방식은 ${kind}`, decision: `모든 모델의 기본 키는 @default(${kind}()) 로 만든다(${n}/${idKinds.length}개 모델).`, evidence: models.filter((m) => m.body.includes(`@default(${kind}(`)).slice(0, 3).map((m) => `${file}:${m.line}`), confidence: n === idKinds.length ? 'code' : 'guess' });
  }
  const soft = models.filter((m) => /\bdeletedAt\b/.test(m.body));
  if (soft.length >= 2) out.push({ topic: 'data.deletion', title: '삭제는 soft delete(deletedAt)', decision: `삭제는 행을 지우지 않고 deletedAt 을 채운다(${soft.length}/${models.length}개 모델).`, evidence: soft.slice(0, 3).map((m) => `${file}:${m.line}`), confidence: soft.length === models.length ? 'code' : 'guess' });
  else if (!soft.length && models.length >= 3) out.push({ topic: 'data.deletion', title: '삭제는 실제 삭제(hard delete)', decision: '삭제는 행을 지운다 — deletedAt 같은 soft delete 열이 없다.', evidence: [`${file}:${models[0].line}`], confidence: 'guess' });
  const mapped = models.filter((m) => /@@map\(/.test(m.body));
  if (mapped.length >= 2) out.push({ topic: 'data.tableNaming', title: '테이블 이름은 @@map 으로 따로 정한다', decision: `모델 이름과 테이블 이름을 @@map 으로 분리한다(${mapped.length}개 모델).`, evidence: mapped.slice(0, 3).map((m) => `${file}:${m.line}`), confidence: 'code' });
  return out;
}

export function decisionCandidates(projectRoot, { stack, runGit = true } = {}) {
  const pkgPath = join(projectRoot, 'package.json');
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : {};
  const stacks = stack ? [stack] : detectStacks(pkg);
  const out = [];
  for (const st of stacks) {
    for (const a of precheckProject(projectRoot, st).areas) {
      if (a.status !== 'adaptable' && a.status !== 'blocking') continue;
      out.push({ topic: a.key, title: `${a.label}은(는) ${a.found}`, decision: `${a.label}에 ${a.found} 를 쓴다(플러그인 기본 ${a.expected} 대신).`, evidence: [`package.json — ${a.found}`], confidence: 'code', blocking: a.status === 'blocking' });
    }
  }
  if (stacks.includes('backend')) {
    const schemaPath = join(projectRoot, 'prisma/schema.prisma');
    if (existsSync(schemaPath)) out.push(...prismaCandidates(readFileSync(schemaPath, 'utf8')));
    const prefix = globalPrefix(projectRoot);
    out.push(prefix
      ? { topic: 'api.prefix', title: `API 경로 prefix 는 /${prefix}`, decision: `모든 엔드포인트는 /${prefix} 아래에 둔다.`, evidence: ['src/main.ts — setGlobalPrefix'], confidence: 'code' }
      : { topic: 'api.prefix', title: 'API 경로 prefix 없음', decision: '엔드포인트에 전역 prefix(/api/v1 등)를 두지 않는다.', evidence: ['src/main.ts — setGlobalPrefix 없음'], confidence: 'guess' });
    const filter = walkSourceFiles(projectRoot).find((f) => /^src\//.test(f) && /@Catch\(/.test(readFileSync(join(projectRoot, f), 'utf8')));
    if (filter) {
      const text = readFileSync(join(projectRoot, filter), 'utf8');
      out.push({ topic: 'api.errorEnvelope', title: '에러 응답은 전역 예외 필터 한 곳에서 만든다', decision: `모든 에러 응답 형식은 ${filter} 가 정한다.`, evidence: [`${filter}:${lineOf(text, /@Catch\(/)}`], confidence: 'code' });
    }
  }
  if (runGit) {
    const r = spawnSync('git', ['log', '-n', '200', '--format=%h %s', '-i', '-E', '--grep=결정|채택|decision|decide|ADR'], { cwd: projectRoot, encoding: 'utf8' });
    if (r.status === 0) for (const l of r.stdout.split('\n').filter(Boolean).slice(0, 10)) out.push({ topic: 'commit', title: l.slice(8), decision: null, evidence: [`commit ${l}`], confidence: 'doc' });
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const si = args.indexOf('--stack');
  const root = resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--stack') ?? '.');
  const r = decisionCandidates(root, { stack: si >= 0 ? args[si + 1] : undefined });
  if (args.includes('--json')) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  else for (const c of r) process.stdout.write(`[${c.confidence}] ${c.topic} — ${c.title}  (${c.evidence.join(' · ')})\n`);
}
