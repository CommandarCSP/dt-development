// 에이전트 비용 측정(GEN-41) — 메시지 id 로 합쳐 세고, 맥락·환산 비용·읽은 파일을 낸다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { measureTranscript, measureSession, renderTable, totals, WEIGHTS } from '../scripts/agentCost.mjs';

const usage = (i, cw, cr, o) => ({ input_tokens: i, cache_creation_input_tokens: cw, cache_read_input_tokens: cr, output_tokens: o });
const LINES = [
  { type: 'user', timestamp: '2026-11-27T00:00:00Z', message: { role: 'user', content: '비밀 프롬프트 본문' } },
  // 같은 메시지 m1 이 두 줄(생각 + 도구 호출)로 나뉜다 — 한 턴으로 센다
  { type: 'assistant', timestamp: '2026-11-27T00:00:10Z', message: { id: 'm1', model: 'claude-opus-5-5', usage: usage(2, 30000, 0, 100), content: [{ type: 'thinking', thinking: '…' }] } },
  { type: 'assistant', message: { id: 'm1', model: 'claude-opus-5-5', usage: usage(2, 30000, 0, 100), content: [{ type: 'tool_use', name: 'Bash', input: { command: `cat ${homedir()}/p/agents/a.md docs/refs/b.md` } }] } },
  { type: 'assistant', message: { id: 'm2', usage: usage(1, 5000, 30000, 200), content: [{ type: 'tool_use', name: 'Read', input: { file_path: `${homedir()}/p/agents/a.md` } }] } },
  { type: 'assistant', timestamp: '2026-11-27T00:05:00Z', message: { id: 'm3', usage: usage(1, 1000, 35000, 3000), content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'x.md', content: 'y' } }] } },
];

test('턴은 메시지 id 로 합쳐 세고, 맥락·환산 비용을 계산한다', () => {
  const s = measureTranscript(LINES);
  assert.equal(s.turns, 3);
  assert.equal(s.firstContext, 30002);
  assert.equal(s.maxContext, 36001);
  assert.equal(s.output, 3300);
  assert.equal(s.cost, Math.round(4 * WEIGHTS.input + 36000 * WEIGHTS.cacheWrite + 65000 * WEIGHTS.cacheRead + 3300 * WEIGHTS.output));
  assert.deepEqual(s.tools, { Bash: 1, Read: 1, Write: 1 });
  assert.equal(s.durationMin, 5);
});

test('읽은 파일 — Read 와 Bash cat, 홈은 ~ 로, 다시 읽음을 센다', () => {
  const s = measureTranscript(LINES);
  assert.deepEqual(s.reads, ['~/p/agents/a.md', 'docs/refs/b.md', '~/p/agents/a.md']);
  assert.equal(s.rereads, 1);
});

test('세션 폴더 — 메타의 에이전트 종류·설명, 표에 프롬프트 본문이 나오지 않는다', () => {
  const root = mkdtempSync(join(tmpdir(), 'cost-'));
  mkdirSync(join(root, 'subagents'));
  writeFileSync(join(root, 'subagents', 'agent-abc.jsonl'), LINES.map((l) => JSON.stringify(l)).join('\n'));
  writeFileSync(join(root, 'subagents', 'agent-abc.meta.json'), JSON.stringify({ agentType: 'dt-development:spec-author', description: 'feed 스펙' }));
  const rows = measureSession(root);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].agentType, 'dt-development:spec-author');
  const md = renderTable(rows, { files: true });
  assert.match(md, /\| dt-development:spec-author \| feed 스펙 \| 3 \|/);
  assert.doesNotMatch(md, /비밀 프롬프트|\/Users\//);
  assert.equal(totals(rows).turns, 3);
  assert.throws(() => measureSession(join(root, 'nope')), /기록 폴더가 없다/);
});
