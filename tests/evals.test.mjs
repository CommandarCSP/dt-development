// 평가(evals/) 형식 검사 — 돌리지는 않는다(돌리면 비용이 든다). 형식은 claude plugin eval 공식 문서를 따른다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const EVALS = join(ROOT, 'evals');
const PROMPT_KEYS = new Set(['schema_version', 'name', 'description', 'tags', 'plugins', 'runs', 'expected_outcome', 'model', 'max_turns', 'timeout_seconds', 'allowed_tools', 'append_system_prompt', 'env']);
const GRADER_TYPES = new Set(['regex', 'tool_used', 'tool_order', 'file_exists', 'llm', 'baseline']);
const fmKeys = (text) => {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? Object.fromEntries(m[1].split('\n').map((l) => l.match(/^([a-z_]+):\s*(.*)$/)).filter(Boolean).map((x) => [x[1], x[2]])) : null;
};
const cases = () => readdirSync(EVALS).filter((d) => d !== 'results' && statSync(join(EVALS, d)).isDirectory());

test('evals: case 마다 prompt.md(허용 키만)·채점기가 있고, scaffold 스크립트가 실제로 있다', () => {
  const problems = [];
  const list = cases();
  assert.ok(list.length >= 2, '핵심 스킬 2개 이상의 평가가 있어야 한다');
  for (const c of list) {
    const dir = join(EVALS, c);
    const prompt = join(dir, 'prompt.md');
    if (!existsSync(prompt)) { problems.push(`${c}: prompt.md 없음`); continue; }
    const fm = fmKeys(readFileSync(prompt, 'utf8'));
    if (!fm) problems.push(`${c}: prompt.md 머리말 없음`);
    else for (const k of Object.keys(fm)) if (!PROMPT_KEYS.has(k)) problems.push(`${c}: prompt.md 모르는 키 ${k}(모르는 키는 실행 오류)`);
    if (fm && !/^\d+$/.test(fm.max_turns ?? '')) problems.push(`${c}: max_turns 를 정한다(기본 10은 스펙 스킬에 모자란다)`);
    const gdir = join(dir, 'graders');
    const graders = existsSync(gdir) ? readdirSync(gdir).filter((f) => f.endsWith('.md')) : [];
    if (!graders.length) problems.push(`${c}: graders/*.md 없음`);
    for (const g of graders) {
      const gfm = fmKeys(readFileSync(join(gdir, g), 'utf8'));
      if (!gfm || !GRADER_TYPES.has(gfm.type)) problems.push(`${c}/graders/${g}: type 이 ${[...GRADER_TYPES].join('|')} 가 아니다`);
    }
    if (!graders.some((g) => /type: tool_used/.test(readFileSync(join(gdir, g), 'utf8')))) problems.push(`${c}: 과정 채점기(tool_used — 어느 스킬·명령을 썼나)가 없다`);
    const yaml = join(dir, 'case.yaml');
    if (existsSync(yaml)) {
      const y = readFileSync(yaml, 'utf8');
      if (!/schema_version: "1\.1"/.test(y)) problems.push(`${c}: case.yaml schema_version "1.1"`);
      const s = y.match(/scaffold_script:\s*(\S+)/)?.[1];
      if (s && !existsSync(join(dir, s))) problems.push(`${c}: scaffold ${s} 없음`);
    }
  }
  assert.deepEqual(problems, []);
});
