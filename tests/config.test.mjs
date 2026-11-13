// 공통 설정 로더 — 설정이 없으면 현행 동작(기본값), 틀린 값은 경고 + 기본값, 던지지 않는다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig, DEFAULTS, modelFor, AGENT_TIERS } from '../scripts/lib/config.mjs';

function withDir(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'dt-config-'));
  try {
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), typeof body === 'string' ? body : JSON.stringify(body));
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('설정 파일이 없으면 기본값 = 현행 동작 (훅 꺼짐, 실행 방식은 묻기)', () => {
  withDir({}, (dir) => {
    const { config, warnings, sources } = loadConfig(dir);
    assert.deepEqual(config, DEFAULTS);
    assert.equal(config.hooks, null);
    assert.equal(config.team.execution, 'ask');
    assert.deepEqual(warnings, []);
    assert.deepEqual(sources, []);
  });
});

test('옛 .dt-pipeline.json 은 hooks 자리로 읽힌다', () => {
  withDir({ '.dt-pipeline.json': { commitThreshold: 3 } }, (dir) => {
    const { config, sources } = loadConfig(dir);
    assert.deepEqual(config.hooks, { enabled: true, commitThreshold: 3, startReminder: true });
    assert.deepEqual(sources, ['.dt-pipeline.json']);
  });
});

test('.dt.json 이 기본값을 덮고, .dt.local.json 이 그 위를 덮는다 (객체는 키 단위 병합)', () => {
  withDir({
    '.dt.json': { team: { execution: 'parallel', models: { builder: 'sonnet' }, requiredMcp: ['figma'] } },
    '.dt.local.json': { team: { models: { reviewer: 'opus' }, requiredMcp: ['atlassian'] } },
  }, (dir) => {
    const { config, warnings, sources } = loadConfig(dir);
    assert.equal(config.team.execution, 'parallel');
    assert.deepEqual(config.team.models, { planner: null, builder: 'sonnet', reviewer: 'opus' });
    assert.deepEqual(config.team.requiredMcp, ['atlassian']);   // 배열은 뒤가 이긴다
    assert.deepEqual(warnings, []);
    assert.deepEqual(sources, ['.dt.json', '.dt.local.json']);
  });
});

test('틀린 값은 경고하고 기본값을 쓴다', () => {
  withDir({ '.dt.json': { team: { execution: 'fast', models: { builder: 'gpt' }, locale: 'en', requiredMcp: 'figma' }, hooks: { commitThreshold: 0 } } }, (dir) => {
    const { config, warnings } = loadConfig(dir);
    assert.equal(config.team.execution, 'ask');
    assert.equal(config.team.models.builder, null);
    assert.equal(config.team.locale, 'ko');
    assert.deepEqual(config.team.requiredMcp, []);
    assert.equal(config.hooks.commitThreshold, 1);
    assert.equal(warnings.length, 5);
  });
});

test('모르는 키는 경고만 하고 버린다', () => {
  withDir({ '.dt.json': { tracker: 'jira', team: { colour: 'red' } } }, (dir) => {
    const { config, warnings } = loadConfig(dir);
    assert.ok(!('tracker' in config));
    assert.ok(warnings.some((w) => w.includes('"tracker"')));
    assert.ok(warnings.some((w) => w.includes('"team.colour"')));
  });
});

test('망가진 JSON 은 던지지 않고 무시한다', () => {
  withDir({ '.dt.json': '{ not json', '.dt.local.json': '[1,2]' }, (dir) => {
    const { config, warnings } = loadConfig(dir);
    assert.deepEqual(config, DEFAULTS);
    assert.equal(warnings.length, 2);
  });
});

test('두 파일에 hooks 가 다 있으면 .dt.json 을 따르고 경고한다', () => {
  withDir({ '.dt-pipeline.json': { commitThreshold: 2 }, '.dt.json': { hooks: { commitThreshold: 4 } } }, (dir) => {
    const { config, warnings } = loadConfig(dir);
    assert.equal(config.hooks.commitThreshold, 4);
    assert.equal(warnings.length, 1);
  });
});

test('modelFor: 에이전트의 티어 값을 돌려주고, 비었으면 null(에이전트 파일의 모델)', () => {
  const config = { team: { models: { planner: 'opus', builder: null, reviewer: 'sonnet' } } };
  assert.equal(modelFor(config, 'spec-author'), 'opus');
  assert.equal(modelFor(config, 'fe-builder'), null);
  assert.equal(modelFor(config, 'auditor'), 'sonnet');
  assert.equal(modelFor(config, 'unknown-agent'), null);
});

test('AGENT_TIERS: 모든 에이전트가 정확히 한 티어에 있다', () => {
  const agentsDir = fileURLToPath(new URL('../agents', import.meta.url));
  const actual = execFileSync('ls', [agentsDir], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort();
  const listed = Object.values(AGENT_TIERS).flat();
  assert.equal(new Set(listed).size, listed.length, '한 에이전트가 두 티어에 있다');
  assert.deepEqual([...listed].sort(), actual);
});

test('CLI: 프로젝트 루트를 받아 { config, warnings, sources } 를 출력한다', () => {
  withDir({ '.dt.json': { team: { execution: 'sequential' } } }, (dir) => {
    const script = fileURLToPath(new URL('../scripts/lib/config.mjs', import.meta.url));
    const out = JSON.parse(execFileSync('node', [script, dir], { encoding: 'utf8' }));
    assert.equal(out.config.team.execution, 'sequential');
    assert.deepEqual(out.sources, ['.dt.json']);
  });
});
