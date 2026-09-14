import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAllRules, STACK_RULE_LOCATIONS } from '../scripts/lib/rule-loader.mjs';
import { STACKS, resolveStack } from '../scripts/lib/stacks.mjs';

const PLUGIN_ROOT = new URL('../../..', import.meta.url).pathname;

test('default loadAllRules still resolves the frontend stack', async () => {
  const def = await loadAllRules(PLUGIN_ROOT);
  const fe = await loadAllRules(PLUGIN_ROOT, STACK_RULE_LOCATIONS.frontend);
  assert.equal(def.length, fe.length);
  assert.ok(def.length >= 1);
});

test('loadAllRules accepts an injected rule-location list', async () => {
  const only = [{ dir: 'skills/dt-frontend-architecture/patterns', source: 'architecture' }];
  const rules = await loadAllRules(PLUGIN_ROOT, only);
  assert.ok(rules.every((r) => r.source === 'architecture'));
  assert.ok(rules.length >= 7);
});

test('backend stack loads architecture rules with no duplicate ruleIds', async () => {
  const rules = await loadAllRules(PLUGIN_ROOT, STACK_RULE_LOCATIONS.backend);
  assert.ok(Array.isArray(rules));
  const archRules = rules.filter((r) => r.source === 'architecture');
  assert.ok(archRules.length >= 15, `expected >= 15 backend architecture rules, got ${archRules.length}`);
  const ids = archRules.map((r) => r.ruleId);
  assert.ok(ids.includes('controller-no-direct-prisma'));
  assert.ok(ids.includes('repository-only-prisma'));
  assert.ok(ids.includes('redis-through-cache-service'));
  const seen = new Set();
  for (const r of rules) {
    assert.ok(!seen.has(r.ruleId), `duplicate backend ruleId: ${r.ruleId}`);
    seen.add(r.ruleId);
  }
});

test('resolveStack returns knobs for known stacks and throws on unknown', () => {
  assert.equal(resolveStack('frontend').configFileName, '.dt-frontend.json');
  assert.equal(resolveStack('backend').configFileName, '.dt-backend.json');
  assert.ok(Array.isArray(STACKS.backend.testCommand));
  assert.throws(() => resolveStack('nope'), /unknown stack/);
});
