#!/usr/bin/env node
/**
 * 핸드북 "왜 이렇게 됐나"의 근거 원천(GEN-13) — 어디서 찾을지와 외부 공개 때 가릴 링크 호스트.
 *
 * 순서(앞이 먼저, 가장 믿을 만한 것):
 *   1. 결정 기록 — 프로젝트 PD(`docs/decisions/`, 공유 폴더 포함) + 플러그인 TP. 설정 없이 늘 읽는다(MCP 불필요).
 *   2. 위키 — `.dt.json` `wiki`: confluence(MCP, 설계·가이드 라벨로 좁힘) · markdown(`docs/wiki/design`·`guide` 직접 읽기) · 그 밖에는 없음.
 *   3. 트래커 — `tracker: jira` 일 때만(MCP, 티켓 검색).
 * 옛 `.dt-handbook.json` `sources.atlassian.enabled: "off"` 는 2·3의 MCP 원천을 끈다(markdown 위키·결정 기록은 그대로).
 *
 * CLI: node scripts/handbook/sources.mjs <projectRoot>  → JSON
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../lib/config.mjs';
import { decisionDirs } from '../decisions.mjs';
import { resolveWikiConfig } from '../wikiConfig.mjs';
import { resolveWorklogConfig } from '../worklogConfig.mjs';

/** TP-003 의 설계·운영 가이드 — "왜"를 담는 문서 종류. */
export const WHY_DOC_TYPES = ['design', 'guide'];

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

const quiet = (fn) => { try { return fn(); } catch { return null; } };

/**
 * @param {string} projectRoot
 * @param {{ handbook?: object|null, dt?: object, wikiCfg?: object|null, worklogCfg?: object|null }} [o] 테스트용 주입
 */
export function resolveHandbookSources(projectRoot, o = {}) {
  const handbook = o.handbook !== undefined ? o.handbook : readJson(join(projectRoot, '.dt-handbook.json'));
  const dt = o.dt ?? loadConfig(projectRoot).config;
  const atl = handbook?.sources?.atlassian ?? {};
  const mcpOff = atl.enabled === 'off' || atl.enabled === false;
  const rel = (p) => relative(projectRoot, p) || '.';

  const dirs = quiet(() => decisionDirs(projectRoot)) ?? { local: join(projectRoot, 'docs/decisions'), shared: null };
  const decisions = {
    dirs: [rel(dirs.local), ...(dirs.shared ? [rel(dirs.shared)] : [])],
    policies: true,
    cite: '[문서] PD-007 · [문서] TP-002 처럼 ID 로',
  };

  let wiki = null;
  const skipped = [];
  if (dt.wiki === 'markdown') {
    wiki = { kind: 'markdown', dirs: WHY_DOC_TYPES.map((t) => `docs/wiki/${t}`), needsMcp: false };
  } else if (dt.wiki === 'confluence') {
    if (mcpOff) skipped.push('wiki(confluence): sources.atlassian.enabled 가 off');
    else {
      const wc = o.wikiCfg !== undefined ? o.wikiCfg : quiet(() => resolveWikiConfig(projectRoot, { dt }));
      wiki = {
        kind: 'confluence',
        space: atl.confluenceSpace || wc?.project?.defaultSpaceKey || null,
        labels: WHY_DOC_TYPES.map((t) => `doc-${t}`),
        needsMcp: true,
      };
    }
  } else skipped.push(`wiki: ${dt.wiki}`);

  let tracker = null;
  if (dt.tracker === 'jira') {
    if (mcpOff) skipped.push('tracker(jira): sources.atlassian.enabled 가 off');
    else {
      const jc = o.worklogCfg !== undefined ? o.worklogCfg : quiet(() => resolveWorklogConfig(projectRoot, { dt }));
      tracker = { kind: 'jira', project: atl.jiraProject || jc?.project?.defaultProjectKey || null, needsMcp: true };
    }
  } else skipped.push(`tracker: ${dt.tracker}`);

  const needsMcp = Boolean(wiki?.needsMcp || tracker?.needsMcp);
  return {
    decisions,
    wiki,
    tracker,
    needsMcp,
    skipped,
    maxHitsPerTopic: atl.maxHitsPerTopic ?? 5,
  };
}

/**
 * 외부 공개(`audience: external`) 때 G8 이 가릴 위키·트래커 링크 호스트.
 * 기본: Atlassian 클라우드·Notion. 팀 설정(.dt-confluence.json·.dt-worklog.json, 개인 파일 포함)의 `site` 도 더한다.
 */
export function linkHosts(projectRoot) {
  const hosts = new Set(['atlassian.net', 'notion.so', 'notion.site']);
  for (const f of ['.dt-confluence.json', '.dt-confluence.local.json', '.dt-worklog.json', '.dt-worklog.local.json']) {
    const site = readJson(join(projectRoot, f))?.site;
    if (typeof site !== 'string' || !site.trim() || /^REPLACE/.test(site)) continue;
    const host = site.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    if (host) hosts.add(host);
  }
  return [...hosts];
}

const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 호스트 목록 → 링크 정규식(그 호스트와 하위 도메인). */
export function linkRegex(hosts) {
  return new RegExp(`https?:\\/\\/(?:[\\w-]+\\.)*(?:${hosts.map(escRe).join('|')})(?:[/:?#]\\S*|(?=\\s|$|[)\\]>"',]|\\.(?:\\s|$)))`, 'g');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? process.cwd());
  if (!existsSync(root)) { process.stderr.write(`없는 경로: ${root}\n`); process.exit(2); }
  process.stdout.write(JSON.stringify({ ...resolveHandbookSources(root), linkHosts: linkHosts(root) }, null, 2) + '\n');
}
