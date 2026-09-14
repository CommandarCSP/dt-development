#!/usr/bin/env node
// Regenerate Atlas sections in SKILL.md files from patterns frontmatter.
//
// 동작:
//   - 각 룰 파일에서 ruleId, summary, severity, body link을 읽어
//     자기 분야 SKILL.md의 <!-- ATLAS:START --> ... <!-- ATLAS:END --> 블록을 교체.
//   - architecture SKILL.md에는 architecture patterns + vendored 모두 포함.
//   - testing SKILL.md에는 testing patterns만 포함.
//
// 사용:
//   node plugin/scripts/regen-atlas.mjs
//
// 룰 추가/수정 시:
//   1. patterns/<id>.md (또는 rules/vendored/*) 추가/편집 (summary 필드 필수)
//   2. 본 스크립트 실행 → SKILL.md atlas 자동 갱신

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..');

const ARCH_PATTERNS_DIR = join(PLUGIN_ROOT, 'skills/dt-frontend-architecture/patterns');
const TEST_PATTERNS_DIR = join(PLUGIN_ROOT, 'skills/dt-frontend-testing/patterns');
const VENDORED_DIR = join(PLUGIN_ROOT, 'rules/vendored/vercel-react-best-practices');

const ARCH_SKILL = join(PLUGIN_ROOT, 'skills/dt-frontend-architecture/SKILL.md');
const TEST_SKILL = join(PLUGIN_ROOT, 'skills/dt-frontend-testing/SKILL.md');

const BE_ARCH_PATTERNS_DIR = join(PLUGIN_ROOT, 'skills/dt-backend-architecture/patterns');
const BE_TEST_PATTERNS_DIR = join(PLUGIN_ROOT, 'skills/dt-backend-testing/patterns');
const BE_ARCH_SKILL = join(PLUGIN_ROOT, 'skills/dt-backend-architecture/SKILL.md');
const BE_TEST_SKILL = join(PLUGIN_ROOT, 'skills/dt-backend-testing/SKILL.md');

const SEVERITY_ORDER = { critical: 0, important: 1, minor: 2 };

// Frontmatter parser (간단한 YAML key:value 추출)
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const data = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    // strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }
  return data;
}

async function loadRules(dir, sourceLabel) {
  const rules = [];
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return rules;
  }
  for (const name of entries) {
    if (!name.endsWith('.md')) continue;
    if (name === 'SOURCE.md' || name === 'README.md') continue;
    const filepath = join(dir, name);
    const text = await readFile(filepath, 'utf8');
    const data = parseFrontmatter(text);
    if (!data || !data.ruleId) continue;
    rules.push({
      ruleId: data.ruleId,
      summary: data.summary || '(summary 미지정 — patterns frontmatter에 summary 필드 추가 필요)',
      severity: data.severity || 'minor',
      source: sourceLabel,
      filepath,
    });
  }
  return rules;
}

function sortRules(rules) {
  return rules.sort((a, b) => {
    const s = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
    if (s !== 0) return s;
    return a.ruleId.localeCompare(b.ruleId);
  });
}

function renderEntry(rule, skillFilepath) {
  const rel = relative(dirname(skillFilepath), rule.filepath);
  return `- **${rule.ruleId}** _(${rule.severity})_ — ${rule.summary} [상세](${rel})`;
}

function renderAtlas(title, sections, skillFilepath) {
  const lines = [`<!-- ATLAS:START — \`node plugin/scripts/regen-atlas.mjs\`로 자동 생성. 직접 수정하지 마세요. -->`];
  for (const { heading, rules } of sections) {
    if (!rules.length) continue;
    lines.push(``, `### ${heading}`);
    for (const r of sortRules(rules)) {
      lines.push(renderEntry(r, skillFilepath));
    }
  }
  lines.push(``, `<!-- ATLAS:END -->`);
  return lines.join('\n');
}

async function injectAtlas(skillPath, atlasBody) {
  let text;
  try {
    text = await readFile(skillPath, 'utf8');
  } catch {
    // SKILL.md not present yet (stack scaffolded incrementally) — skip silently.
    return false;
  }
  const startMarker = /<!-- ATLAS:START[^>]*-->/;
  const endMarker = /<!-- ATLAS:END -->/;
  const startMatch = text.match(startMarker);
  const endMatch = text.match(endMarker);
  if (!startMatch || !endMatch) {
    throw new Error(
      `Markers not found in ${skillPath}. SKILL.md에 다음 두 마커를 추가하세요:\n` +
      `  <!-- ATLAS:START -->\n  <!-- ATLAS:END -->`,
    );
  }
  const before = text.slice(0, startMatch.index);
  const after = text.slice(endMatch.index + endMatch[0].length);
  const next = `${before}${atlasBody}${after}`;
  if (next === text) return false;
  await writeFile(skillPath, next, 'utf8');
  return true;
}

async function main() {
  const archRules = await loadRules(ARCH_PATTERNS_DIR, 'architecture');
  const testRules = await loadRules(TEST_PATTERNS_DIR, 'testing');
  const vendoredRules = await loadRules(VENDORED_DIR, 'vendored:react');

  // Architecture SKILL.md atlas — architecture rules + vendored
  const archAtlas = renderAtlas(
    'Atlas',
    [
      { heading: 'Architecture', rules: archRules },
      { heading: 'React Best Practices (vendored)', rules: vendoredRules },
    ],
    ARCH_SKILL,
  );

  // Testing SKILL.md atlas — testing rules only
  const testAtlas = renderAtlas(
    'Atlas',
    [{ heading: 'Testing', rules: testRules }],
    TEST_SKILL,
  );

  // Backend stack (NestJS) — architecture + testing rules, no vendored.
  const beArchRules = await loadRules(BE_ARCH_PATTERNS_DIR, 'architecture');
  const beTestRules = await loadRules(BE_TEST_PATTERNS_DIR, 'testing');
  const beArchAtlas = renderAtlas('Atlas', [{ heading: 'Architecture', rules: beArchRules }], BE_ARCH_SKILL);
  const beTestAtlas = renderAtlas('Atlas', [{ heading: 'Testing', rules: beTestRules }], BE_TEST_SKILL);

  let changed = 0;
  const targets = [
    [ARCH_SKILL, archAtlas],
    [TEST_SKILL, testAtlas],
    [BE_ARCH_SKILL, beArchAtlas],
    [BE_TEST_SKILL, beTestAtlas],
  ];
  for (const [skill, atlas] of targets) {
    if (await injectAtlas(skill, atlas)) {
      console.log(`updated ${basename(skill)}`);
      changed++;
    }
  }

  if (changed === 0) {
    console.log('no changes');
  }
  console.log(
    `loaded FE: ${archRules.length} architecture + ${testRules.length} testing + ${vendoredRules.length} vendored | ` +
    `BE: ${beArchRules.length} architecture + ${beTestRules.length} testing`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
