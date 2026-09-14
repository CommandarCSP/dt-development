import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAllRules, STACK_RULE_LOCATIONS } from '../scripts/lib/rule-loader.mjs';

const PLUGIN_ROOT = new URL('../../..', import.meta.url).pathname;

test('loads architecture patterns', async () => {
  const rules = await loadAllRules(PLUGIN_ROOT);
  const archRules = rules.filter((r) => r.source === 'architecture');
  assert.ok(archRules.length >= 7, `expected >= 7 architecture rules, got ${archRules.length}`);
  const ids = archRules.map((r) => r.ruleId);
  assert.ok(ids.includes('domain-no-direct-api'));
  assert.ok(ids.includes('pure-view-component'));
});

test('loads testing patterns', async () => {
  const rules = await loadAllRules(PLUGIN_ROOT);
  const testRules = rules.filter((r) => r.source === 'testing');
  assert.ok(testRules.length >= 9, `expected >= 9 testing rules, got ${testRules.length}`);
  const ids = testRules.map((r) => r.ruleId);
  assert.ok(ids.includes('integration-no-hook-mocking'));
});

test('loads vendored vercel rules', async () => {
  const rules = await loadAllRules(PLUGIN_ROOT);
  const vendored = rules.filter((r) => r.source === 'vendored:vercel-react-best-practices');
  assert.ok(vendored.length >= 1);
});

test('every rule has required fields', async () => {
  const rules = await loadAllRules(PLUGIN_ROOT);
  for (const r of rules) {
    assert.ok(r.ruleId, `missing ruleId in ${r.filepath}`);
    assert.ok(r.severity, `missing severity in ${r.filepath}`);
    assert.ok(Array.isArray(r.appliesTo), `appliesTo not array in ${r.filepath}`);
    assert.ok(Array.isArray(r.detection), `detection not array in ${r.filepath}`);
  }
});

test('rules expose excludePathPatterns (defaults to [])', async () => {
  const rules = await loadAllRules(PLUGIN_ROOT);
  for (const r of rules) {
    assert.ok(Array.isArray(r.excludePathPatterns), `${r.ruleId}: excludePathPatterns must be array`);
  }
});

test('rules expose overridable(false default) + overrideKey(null default)', async () => {
  const rules = await loadAllRules(PLUGIN_ROOT, STACK_RULE_LOCATIONS.frontend);
  for (const r of rules) {
    assert.equal(typeof r.overridable, 'boolean', `${r.ruleId}: overridable boolean`);
    assert.ok(r.overrideKey === null || typeof r.overrideKey === 'string', `${r.ruleId}: overrideKey null|string`);
  }
});

test('sentry-breadcrumb-no-pii loads as a minor manual-review rule', async () => {
  const rules = await loadAllRules(PLUGIN_ROOT); // 파일 상단의 기존 import·PLUGIN_ROOT 상수 사용
  const rule = rules.find((r) => r.ruleId === 'sentry-breadcrumb-no-pii');
  assert.ok(rule, 'rule should be discovered by the loader');
  assert.equal(rule.severity, 'minor');
  assert.equal(rule.detection[0].type, 'ast-rule');
});

test('no duplicate ruleIds across sources', async () => {
  const rules = await loadAllRules(PLUGIN_ROOT);
  const seen = new Set();
  for (const r of rules) {
    assert.ok(!seen.has(r.ruleId), `duplicate ruleId: ${r.ruleId}`);
    seen.add(r.ruleId);
  }
});
