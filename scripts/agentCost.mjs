/**
 * 에이전트 비용 측정 — Claude Code 세션 기록(`~/.claude/projects/<프로젝트>/<세션>/subagents/*.jsonl`)에서
 * 서브에이전트마다 턴 수·맥락 크기·캐시·출력·걸린 시간·읽은 파일을 센다(GEN-41).
 *
 * 쓰는 곳: 대표 흐름의 기준선을 잴 때, 절감안을 적용한 뒤 다시 잴 때. 결과 표는 docs/specs/2026-11-27-agent-cost-baseline.md.
 *
 * 읽는 법:
 *   - 에이전트는 턴마다 그때까지 쌓인 맥락을 다시 읽는다. 그래서 비용 ≈ 평균 맥락 × 턴 수다.
 *   - "시작 맥락"은 첫 턴의 맥락 — 시스템 지시 + 에이전트 정의 + 처음 받은 프롬프트다.
 *   - 환산 비용은 입력 토큰 기준 가중합이다(입력 1 · 캐시 쓰기 1.25 · 캐시 읽기 0.1 · 출력 5). 요금표가 바뀌면 WEIGHTS 를 고친다.
 *
 * 출력에 프롬프트 본문은 넣지 않는다. 경로의 홈 디렉터리는 `~` 로 줄인다.
 */
import { existsSync, readdirSync, readFileSync, statSync, realpathSync } from 'node:fs';
import { basename, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const WEIGHTS = { input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 };

const HOME = homedir();
const tidy = (p) => String(p ?? '').split(HOME).join('~');
/** Bash 명령에서 읽은 파일 — cat·sed -n·head·tail 의 인자 중 확장자가 있는 것. */
const BASH_READ_RE = /\b(?:cat|head|tail|sed\s+-n\s+'?[^'\s]*'?)\s+((?:[^\s|;&>]+\.[A-Za-z0-9]+\s*)+)/g;
const bashFiles = (cmd) => [...String(cmd).matchAll(BASH_READ_RE)].flatMap((m) => m[1].trim().split(/\s+/)).filter((f) => !f.startsWith('-'));

/**
 * 기록 한 개(jsonl 줄 배열)를 센다. 같은 메시지가 여러 줄로 나뉘어 들어오니 message.id 로 합친다.
 * @returns {{ turns, input, cacheWrite, cacheRead, output, total, cost, firstContext, maxContext, avgContext, model, durationMin, tools, reads, rereads }}
 */
export function measureTranscript(lines) {
  const msgs = new Map();
  let t0 = null; let t1 = null;
  for (const l of lines) {
    if (l.timestamp) { t0 ??= l.timestamp; t1 = l.timestamp; }
    const m = l.message;
    if (l.type !== 'assistant' || !m?.id) continue;
    const cur = msgs.get(m.id) ?? { usage: null, model: m.model, content: [] };
    if (m.usage) cur.usage = m.usage;             // 마지막 줄의 usage 가 최종값이다
    cur.content.push(...(Array.isArray(m.content) ? m.content : []));
    msgs.set(m.id, cur);
  }
  const s = { turns: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, firstContext: 0, maxContext: 0, model: null, tools: {}, reads: [] };
  for (const { usage: u, model, content } of msgs.values()) {
    if (!u) continue;
    s.turns++;
    const cw = u.cache_creation_input_tokens ?? 0; const cr = u.cache_read_input_tokens ?? 0;
    s.input += u.input_tokens ?? 0; s.cacheWrite += cw; s.cacheRead += cr; s.output += u.output_tokens ?? 0;
    const ctx = (u.input_tokens ?? 0) + cw + cr;
    if (s.turns === 1) s.firstContext = ctx;
    s.maxContext = Math.max(s.maxContext, ctx);
    s.model ??= model ?? null;
    for (const c of content) {
      if (c.type !== 'tool_use') continue;
      s.tools[c.name] = (s.tools[c.name] ?? 0) + 1;
      if (c.name === 'Read' && c.input?.file_path) s.reads.push(tidy(c.input.file_path));
      if (c.name === 'Bash' && c.input?.command) s.reads.push(...bashFiles(c.input.command).map(tidy));
    }
  }
  s.total = s.input + s.cacheWrite + s.cacheRead + s.output;
  s.cost = Math.round(s.input * WEIGHTS.input + s.cacheWrite * WEIGHTS.cacheWrite + s.cacheRead * WEIGHTS.cacheRead + s.output * WEIGHTS.output);
  s.avgContext = s.turns ? Math.round((s.input + s.cacheWrite + s.cacheRead) / s.turns) : 0;
  s.durationMin = t0 && t1 ? Math.round((new Date(t1) - new Date(t0)) / 60000) : null;
  const seen = new Map();
  for (const r of s.reads) seen.set(basename(r), (seen.get(basename(r)) ?? 0) + 1);
  s.rereads = [...seen.values()].reduce((a, n) => a + Math.max(0, n - 1), 0);
  return s;
}

const readJsonl = (file) => readFileSync(file, 'utf8').split('\n').filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });

/** 세션 폴더(`<세션>/` 또는 `<세션>/subagents/`)에서 서브에이전트마다 잰다. */
export function measureSession(path) {
  const dir = existsSync(join(path, 'subagents')) ? join(path, 'subagents') : path;
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`서브에이전트 기록 폴더가 없다: ${tidy(path)}`);
  return readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort().map((f) => {
    const metaPath = join(dir, f.replace(/\.jsonl$/, '.meta.json'));
    let meta = {};
    try { meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {}; } catch { /* 메타 없이 */ }
    return { id: f.replace(/^agent-|\.jsonl$/g, ''), agentType: meta.agentType ?? '?', description: meta.description ?? '', ...measureTranscript(readJsonl(join(dir, f))) };
  });
}

/** 합계 한 줄. */
export function totals(rows) {
  const t = { agents: rows.length, turns: 0, total: 0, cost: 0, output: 0, durationMin: 0 };
  for (const r of rows) { t.turns += r.turns; t.total += r.total; t.cost += r.cost; t.output += r.output; t.durationMin += r.durationMin ?? 0; }
  return t;
}

const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : `${Math.round(n / 1e3)}k`);

/** 마크다운 표. files=true 면 에이전트마다 많이 읽은 파일을 붙인다. */
export function renderTable(rows, { files = false } = {}) {
  const out = ['| 에이전트 | 설명 | 턴 | 시작 맥락 | 평균 맥락 | 최대 맥락 | 출력 | 처리 합계 | 환산 비용 | 시간 |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of rows) out.push(`| ${r.agentType} | ${r.description} | ${r.turns} | ${k(r.firstContext)} | ${k(r.avgContext)} | ${k(r.maxContext)} | ${k(r.output)} | ${k(r.total)} | ${k(r.cost)} | ${r.durationMin ?? '-'}분 |`);
  const t = totals(rows);
  out.push(`| **합계** | ${t.agents}개 | ${t.turns} | | | | ${k(t.output)} | ${k(t.total)} | ${k(t.cost)} | ${t.durationMin}분 |`);
  if (files) {
    for (const r of rows) {
      const count = new Map();
      for (const p of r.reads) count.set(p, (count.get(p) ?? 0) + 1);
      const top = [...count].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([p, n]) => `${p}${n > 1 ? ` ×${n}` : ''}`);
      out.push('', `- **${r.description || r.id}** 읽은 파일 ${r.reads.length}번(다시 읽음 ${r.rereads}): ${top.join(' · ') || '없음'}`);
    }
  }
  return out.join('\n');
}

// ── CLI ───────────────────────────────────────────────────────────────
const isMain = (() => { try { return process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) {
  const args = process.argv.slice(2);
  const USAGE = 'Usage: node scripts/agentCost.mjs <세션 폴더> [--match <정규식>] [--files] [--json]\n  세션 폴더: ~/.claude/projects/<프로젝트>/<세션 id>/\n';
  const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const path = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--match');
  if (!path) { process.stderr.write(USAGE); process.exit(2); }
  try {
    let rows = measureSession(path);
    const match = opt('--match');
    if (match) { const re = new RegExp(match, 'i'); rows = rows.filter((r) => re.test(r.description) || re.test(r.agentType)); }
    rows.sort((a, b) => b.cost - a.cost);
    if (args.includes('--json')) process.stdout.write(`${JSON.stringify({ weights: WEIGHTS, rows: rows.map(({ reads, ...r }) => ({ ...r, readCount: reads.length })), totals: totals(rows) }, null, 2)}\n`);
    else process.stdout.write(`${renderTable(rows, { files: args.includes('--files') })}\n`);
  } catch (e) { process.stderr.write(`❌ ${e.message}\n`); process.exit(1); }
}
