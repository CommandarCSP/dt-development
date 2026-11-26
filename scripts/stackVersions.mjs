#!/usr/bin/env node
/**
 * 검증된 스택 버전(`templates/stack-versions.json`) — 스캐폴드가 설치할 때, 스택 사전 점검이 major 를 비교할 때 쓴다(GEN-24).
 *
 * CLI
 *   node scripts/stackVersions.mjs <frontend|backend> --create    → 프로젝트 생성 도구(예: create-vite@7)
 *   node scripts/stackVersions.mjs <frontend|backend> --deps      → "pkg@^N pkg@^N …" (dependencies)
 *   node scripts/stackVersions.mjs <frontend|backend> --dev       → devDependencies 같은 형식
 *   node scripts/stackVersions.mjs backend --auth-deps | --auth-dev → 인증(JWT)을 고른 프로젝트만 더하는 묶음
 *   node scripts/stackVersions.mjs frontend --sentry-deps | --sentry-dev → Sentry 관측을 켜는 프로젝트만 더하는 묶음
 *   node scripts/stackVersions.mjs <frontend|backend> --group <묶음 이름>  → 그 묶음(예: prismaDevDependencies)
 *   node scripts/stackVersions.mjs <frontend|backend> --check <projectRoot>  → major 가 다른 패키지 목록(JSON)
 * 새 프로젝트 설치는 묶음을 직접 고르지 말고 scripts/scaffoldPreset.mjs 가 프리셋으로 낸 명령을 쓴다(GEN-07).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSIONS = JSON.parse(readFileSync(fileURLToPath(new URL('../templates/stack-versions.json', import.meta.url)), 'utf8'));

const major = (range) => {
  const m = String(range ?? '').match(/(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return m[1] === '0' && m[2] !== undefined ? `0.${m[2]}` : m[1];
};

/** "pkg@^N" 목록. */
export function installList(stack, kind = 'dependencies') {
  return Object.entries(VERSIONS[stack]?.[kind] ?? {}).map(([p, v]) => `${p}@${v}`);
}

/** 설치 묶음 이름 전부(…Dependencies). 프리셋이 이 이름으로 고른다. */
export function groupNames(stack) {
  return Object.keys(VERSIONS[stack] ?? {}).filter((k) => /Dependencies$|^dependencies$/.test(k));
}

/** 프로젝트 package.json 에서 검증 범위와 major 가 다른 패키지. 없는 패키지는 보지 않는다. 모든 묶음을 본다. */
export function majorMismatches(pkg, stack) {
  const s = VERSIONS[stack] ?? {};
  const want = Object.assign({}, ...groupNames(stack).map((g) => s[g]));
  const have = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  return Object.entries(want)
    .filter(([p]) => p in have && major(have[p]) && major(have[p]) !== major(want[p]))
    .map(([p, v]) => ({ package: p, expected: v, found: have[p] }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [stack, flag, root] = process.argv.slice(2);
  if (!VERSIONS[stack]) { process.stderr.write('usage: stackVersions.mjs <frontend|backend> --create|--deps|--dev|--check <root>\n'); process.exit(2); }
  if (flag === '--create') process.stdout.write(VERSIONS[stack].create + '\n');
  else if (flag === '--deps') process.stdout.write(installList(stack, 'dependencies').join(' ') + '\n');
  else if (flag === '--dev') process.stdout.write(installList(stack, 'devDependencies').join(' ') + '\n');
  else if (flag === '--auth-deps') process.stdout.write(installList(stack, 'authDependencies').join(' ') + '\n');
  else if (flag === '--sentry-deps') process.stdout.write(installList(stack, 'sentryDependencies').join(' ') + '\n');
  else if (flag === '--sentry-dev') process.stdout.write(installList(stack, 'sentryDevDependencies').join(' ') + '\n');
  else if (flag === '--auth-dev') process.stdout.write(installList(stack, 'authDevDependencies').join(' ') + '\n');
  else if (flag === '--group') {
    if (!groupNames(stack).includes(root)) { process.stderr.write(`모르는 묶음 '${root}' — ${groupNames(stack).join(', ')}\n`); process.exit(2); }
    process.stdout.write(installList(stack, root).join(' ') + '\n');
  }
  else if (flag === '--check') {
    const p = join(resolve(root ?? '.'), 'package.json');
    const pkg = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
    process.stdout.write(JSON.stringify(majorMismatches(pkg, stack), null, 2) + '\n');
  }
}
