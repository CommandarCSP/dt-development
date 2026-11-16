#!/usr/bin/env node
/**
 * 산출물 형식 점검·이전 — 프로젝트의 dt 산출물이 플러그인의 현재 형식과 맞는지 한 번에 본다.
 * 무엇을 어떻게 판정하는지는 `scripts/artifactSchemas.mjs`, 정책은 `docs/refs/compat-policy.md`. 스킬은 `/dt-migrate`.
 *
 * CLI: node scripts/migrate.mjs <projectRoot> [--write] [--resolve drop|keep] [--stack frontend|backend] [--json]
 *   기본은 미리보기. 종료 코드: 0 할 일 없음 · 1 옮길 것(또는 손으로 볼 것)이 있음 · 2 플러그인보다 새 형식이 있음
 *   --write: 이전 함수가 있는 것만 옮긴다. 고를 것(겹치는 절·스택)이 남은 파일은 건너뛰고 알린다.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { schemaFor } from './artifactSchemas.mjs';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.dt-adopt', '.dt-spec', '.dt-fullstack', '.dt-handbook', 'coverage']);

function walk(root, dir = root, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(root, join(dir, e.name), out); }
    else out.push(relative(root, join(dir, e.name)).replace(/\\/g, '/'));
  }
  return out;
}

const depsAt = (root) => {
  try { const p = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')); return { ...(p.dependencies ?? {}), ...(p.devDependencies ?? {}) }; } catch { return {}; }
};

/** 루트 바로 아래 설정 파일 + docs/ 아래만 본다(코드 폴더를 훑지 않는다). */
export function scan(projectRoot, { stack } = {}) {
  const files = [...['.dt.json', '.dt-frontend.json', '.dt-backend.json'].filter((f) => existsSync(join(projectRoot, f))), ...walk(projectRoot, join(projectRoot, 'docs'))];
  const deps = depsAt(projectRoot);
  const out = [];
  for (const path of files) {
    const schema = schemaFor(path);
    if (!schema) continue;
    const text = readFileSync(join(projectRoot, path), 'utf8');
    const d = schema.detect(text, { stack, deps });
    out.push({ path, kind: schema.kind, version: d.version, current: schema.current, marked: d.marked, status: d.status, note: d.note });
  }
  return out;
}

/** 이전 함수가 있는 것만 옮긴다. @returns {{ written: string[], blocked: {path,message}[] }} */
export function apply(projectRoot, { resolve: res, stack, write = true } = {}) {
  const deps = depsAt(projectRoot);
  const written = []; const blocked = []; const previews = [];
  for (const f of scan(projectRoot, { stack }).filter((x) => x.status === 'migrate')) {
    const schema = schemaFor(f.path);
    const text = readFileSync(join(projectRoot, f.path), 'utf8');
    const r = schema.migrate(text, { stack, deps, resolve: res });
    if (r.blocked) { blocked.push({ path: f.path, message: r.message }); continue; }
    previews.push({ path: f.path, md: r.md });
    if (write) { writeFileSync(join(projectRoot, f.path), r.md); written.push(f.path); }
  }
  return { written, blocked, previews };
}

const LABEL = { current: '현재', migrate: '옮김', manual: '손으로', newer: '더 새것' };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  const root = resolve(args.find((a, i) => !a.startsWith('--') && !['--resolve', '--stack'].includes(args[i - 1])) ?? process.cwd());
  const stack = opt('stack');
  const found = scan(root, { stack });
  const pending = found.filter((f) => f.status !== 'current');
  if (args.includes('--json')) { process.stdout.write(JSON.stringify(found, null, 2) + '\n'); process.exit(found.some((f) => f.status === 'newer') ? 2 : pending.length ? 1 : 0); }
  process.stdout.write(`산출물 ${found.length}개 · 현재 ${found.length - pending.length} · 볼 것 ${pending.length}\n`);
  for (const f of pending) process.stdout.write(`  ${LABEL[f.status].padEnd(4)} ${f.path} (${f.kind} ${f.version ?? '?'} → ${f.current})${f.note ? ` — ${f.note}` : ''}\n`);
  if (found.some((f) => f.status === 'newer')) process.stdout.write('! 플러그인보다 새 형식이 있다 — 플러그인을 업데이트한 뒤 쓴다\n');
  if (!pending.length) { process.stdout.write('할 일 없음\n'); process.exit(0); }
  const r = apply(root, { resolve: opt('resolve'), stack, write: args.includes('--write') });
  for (const b of r.blocked) process.stdout.write(`  고를 것 ${b.path} — ${b.message}\n`);
  if (args.includes('--write')) process.stdout.write(r.written.length ? `옮겼다: ${r.written.join(', ')}\n` : '옮긴 파일 없음\n');
  else if (r.previews.length) process.stdout.write(`--write 로 ${r.previews.length}개를 옮긴다(미리보기다)\n`);
  process.exit(found.some((f) => f.status === 'newer') ? 2 : 1);
}
