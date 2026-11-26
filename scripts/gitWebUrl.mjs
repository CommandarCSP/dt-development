#!/usr/bin/env node
/**
 * git 리모트 → 웹 주소(커밋·PR) — 작업 기록의 산출물 링크(GEN-09). GitHub·GitLab·Bitbucket(bitbucket.org).
 *
 * 호스트 종류 고르는 순서: 인자/설정 `gitHost` → 호스트 이름(github.com·gitlab.com·이름에 gitlab·bitbucket.org) → 모름(null).
 * 모르면 지어내지 않는다 — 스킬이 사람에게 한 번 묻고 `.dt-worklog.json` 의 `gitHost` 에 적는다.
 *
 * CLI
 *   node scripts/gitWebUrl.mjs [--project <dir>] [--remote <url>] [--host github|gitlab|bitbucket] [--base <웹 베이스>] base
 *   node scripts/gitWebUrl.mjs … commit <sha>
 *   node scripts/gitWebUrl.mjs … pr <번호>
 *   node scripts/gitWebUrl.mjs … compare <base> <head>   (PR 만들기 화면)
 *   종류를 모르면 종료 코드 3(사람에게 물어 --host 또는 gitHost 로 다시).
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GIT_HOSTS = ['github', 'gitlab', 'bitbucket'];

// 브랜치 이름의 / 는 GitHub compare 경로에서 그대로 둔다.
const enc = (b) => encodeURIComponent(b).replace(/%2F/g, '/');

const PATHS = {
  github: { commit: (sha) => `/commit/${sha}`, pr: (n) => `/pull/${n}`, compare: (b, h) => `/compare/${enc(b)}...${enc(h)}?expand=1` },
  gitlab: { commit: (sha) => `/-/commit/${sha}`, pr: (n) => `/-/merge_requests/${n}`, compare: (b, h) => `/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(h)}&merge_request%5Btarget_branch%5D=${encodeURIComponent(b)}` },
  bitbucket: { commit: (sha) => `/commits/${sha}`, pr: (n) => `/pull-requests/${n}`, compare: (b, h) => `/pull-requests/new?source=${encodeURIComponent(h)}&dest=${encodeURIComponent(b)}` },
};

/**
 * 리모트 주소 → { host, path, webBase }. 모양을 모르면 null.
 *   git@host:group/repo.git · ssh://git@host:2222/group/repo.git · https://user@host/group/repo(.git)
 */
export function parseRemote(remote) {
  const s = String(remote ?? '').trim();
  let host; let path;
  let m = s.match(/^(?:ssh|git\+ssh|https?|git):\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+)$/);
  if (m) [, host, path] = m;
  else if ((m = s.match(/^(?:[^@/]+@)?([^/:]+):(?!\/)(.+)$/))) [, host, path] = m;
  else return null;
  path = path.replace(/\.git\/?$/, '').replace(/\/+$/, '');
  if (!host || !path) return null;
  return { host: host.toLowerCase(), path, webBase: `https://${host.toLowerCase()}/${path}` };
}

/** 호스트 이름으로 종류를 짐작한다. 모르면 null(사설 호스트는 설정으로). */
export function detectHost(host) {
  const h = String(host ?? '').toLowerCase();
  if (h === 'github.com' || h.endsWith('.github.com')) return 'github';
  if (h === 'bitbucket.org') return 'bitbucket';
  if (h === 'gitlab.com' || /(^|[.-])gitlab([.-]|$)/.test(h)) return 'gitlab';
  return null;
}

/**
 * @param {{ remote?: string, gitHost?: string|null, gitWebBaseUrl?: string|null }} o
 * @returns {{ kind: string|null, webBase: string|null, from: string }}
 */
export function resolveGitWeb({ remote, gitHost = null, gitWebBaseUrl = null } = {}) {
  if (gitHost != null && !GIT_HOSTS.includes(gitHost)) throw new Error(`gitHost '${gitHost}' 는 모른다 — ${GIT_HOSTS.join(' | ')}`);
  const parsed = parseRemote(remote);
  const webBase = gitWebBaseUrl ? String(gitWebBaseUrl).replace(/\/+$/, '') : parsed?.webBase ?? null;
  if (gitHost) return { kind: gitHost, webBase, from: 'gitHost 설정' };
  const kind = detectHost(gitWebBaseUrl ? new URL(webBase).host : parsed?.host);
  return { kind, webBase, from: kind ? '호스트 이름' : '모름' };
}

export function commitUrl(web, sha) {
  if (!web.kind || !web.webBase) return null;
  return web.webBase + PATHS[web.kind].commit(sha);
}
export function prUrl(web, n) {
  if (!web.kind || !web.webBase) return null;
  return web.webBase + PATHS[web.kind].pr(n);
}

/** PR(머지 요청) 만들기 화면 — head 를 base 로 합치는 요청(GEN-12 pr 모드). */
export function compareUrl(web, base, head) {
  if (!web.kind || !web.webBase) return null;
  return web.webBase + PATHS[web.kind].compare(base, head);
}

export function originRemote(projectRoot) {
  try { return execFileSync('git', ['-C', projectRoot, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(`--${k}`); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
  const project = resolve(opt('project') ?? process.cwd());
  const remote = opt('remote') ?? originRemote(project);
  try {
    const web = resolveGitWeb({ remote, gitHost: opt('host') ?? null, gitWebBaseUrl: opt('base') ?? null });
    const [what, arg] = args;
    if (!web.webBase) { process.stderr.write('git 리모트(origin)가 없거나 모양을 모른다 — --remote 나 --base 로 준다\n'); process.exit(2); }
    if (!web.kind) { process.stderr.write(`호스트 종류를 모른다(${web.webBase}) — ${GIT_HOSTS.join('|')} 중 무엇인지 물어 --host(설정 gitHost)로 준다\n`); process.exit(3); }
    if (what === 'commit' && arg) process.stdout.write(commitUrl(web, arg) + '\n');
    else if (what === 'pr' && arg) process.stdout.write(prUrl(web, arg) + '\n');
    else if (what === 'compare' && arg && args[2]) process.stdout.write(compareUrl(web, arg, args[2]) + '\n');
    else process.stdout.write(JSON.stringify(web) + '\n');
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }
}
