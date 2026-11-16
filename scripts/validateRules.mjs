#!/usr/bin/env node
/**
 * 리뷰 규칙 머리말 검사 — `docs/refs/rule-frontmatter.schema.json` 과 같은 규칙을 의존성 없이 본다.
 * 리뷰 엔진(rule-loader)은 틀린 머리말을 조용히 넘긴다(ruleId 없으면 건너뜀, severity 가 이상하면 minor,
 * 필수 인자가 없는 검출은 빈 결과). 그래서 "검사하는 척"하는 규칙이 생긴다 — 여기서 막는다.
 *
 * CLI: node scripts/validateRules.mjs [--json]   — 오류가 있으면 exit 1
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../skills/dt-frontend-review/scripts/lib/frontmatter.mjs';
import { STACK_RULE_LOCATIONS } from '../skills/dt-frontend-review/scripts/lib/rule-loader.mjs';

export const PLUGIN_ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SCHEMA = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'docs/refs/rule-frontmatter.schema.json'), 'utf8'));
const DETECTION_DIR = 'skills/dt-frontend-review/scripts/lib/detection';

/** 검출 type 목록 — 검출기 파일 이름 + manual(검출기 없음, 사람 확인). 스키마의 enum 과 같아야 한다(테스트). */
export function engineDetectionTypes(root = PLUGIN_ROOT) {
  return [...readdirSync(join(root, DETECTION_DIR)).filter((f) => f.endsWith('.mjs')).map((f) => f.replace(/\.mjs$/, '')), 'manual'].sort();
}

const TOP = SCHEMA.properties;
const REQUIRED_BY_TYPE = Object.fromEntries(SCHEMA.properties.detection.items.allOf.map((c) => [c.if.properties.type.const, c.then.required]));
const isStrArr = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * @param {object} data 머리말
 * @param {{ file?: string, ruleIds?: Set<string> }} ctx ruleIds = 같은 스택의 ruleId 들(relatedRules 확인용)
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateRule(data, { file = '', ruleIds = null } = {}) {
  const errors = []; const warnings = [];
  if (!data || typeof data !== 'object') return { errors: ['머리말이 없다(--- 블록)'], warnings };
  for (const k of SCHEMA.required) if (data[k] == null) errors.push(`${k} 가 없다`);
  for (const k of Object.keys(data)) if (!(k in TOP)) warnings.push(`모르는 키 "${k}" — 엔진이 읽지 않는다`);
  if (data.ruleId != null) {
    if (!new RegExp(TOP.ruleId.pattern).test(data.ruleId)) errors.push(`ruleId "${data.ruleId}" 는 kebab-case`);
    const stem = basename(file).replace(/\.md$/, '');
    if (file && stem !== data.ruleId) errors.push(`ruleId "${data.ruleId}" 와 파일 이름 "${stem}" 이 다르다`);
  }
  if (data.severity != null && !TOP.severity.enum.includes(data.severity)) errors.push(`severity "${data.severity}" 는 ${TOP.severity.enum.join('|')} 중 하나`);
  if (data.appliesTo != null && (!isStrArr(data.appliesTo) || !data.appliesTo.length)) errors.push('appliesTo 는 비지 않은 문자열 배열');
  for (const k of ['excludePathPatterns', 'relatedRules']) if (data[k] != null && !isStrArr(data[k])) errors.push(`${k} 는 문자열 배열`);
  if (data.overridable != null && typeof data.overridable !== 'boolean') errors.push('overridable 은 true|false');
  if (data.overridable === true && !data.overrideKey) errors.push('overridable: true 면 overrideKey 가 있어야 한다');
  if (ruleIds && isStrArr(data.relatedRules)) for (const r of data.relatedRules) if (!ruleIds.has(r)) errors.push(`relatedRules 의 "${r}" 가 같은 스택에 없다`);
  if (data.detection != null) {
    if (!Array.isArray(data.detection) || !data.detection.length) errors.push('detection 은 비지 않은 배열 — 기계 검출이 없으면 type: manual');
    else data.detection.forEach((d, i) => {
      const at = `detection[${i}]`;
      if (!d || typeof d !== 'object' || !d.type) { errors.push(`${at}: type 이 없다`); return; }
      if (!TOP.detection.items.properties.type.enum.includes(d.type)) { errors.push(`${at}: 모르는 type "${d.type}"`); return; }
      for (const k of REQUIRED_BY_TYPE[d.type] ?? []) if (d[k] == null || d[k] === '') errors.push(`${at} (${d.type}): ${k} 가 없다 — 없으면 검출기가 빈 결과를 내 "검사하는 척"한다`);
      if (d.type === 'forbidden-pattern' && d.pattern) {
        try { new RegExp(d.pattern, (d.flags ?? 'g').replace(/[^gimsuy]/g, '')); } catch (e) { errors.push(`${at}: pattern 정규식 오류 — ${e.message}`); }
      }
    });
  }
  return { errors, warnings };
}

/** 모든 스택의 규칙 파일을 검사한다. */
export function validateAll(root = PLUGIN_ROOT) {
  const results = [];
  const seenDirs = new Set();
  for (const [stack, locs] of Object.entries(STACK_RULE_LOCATIONS)) {
    const files = [];
    for (const { dir } of locs) {
      const abs = join(root, dir);
      if (!existsSync(abs)) continue;
      for (const f of readdirSync(abs).filter((x) => x.endsWith('.md') && x !== 'SOURCE.md' && x !== 'README.md')) files.push(join(dir, f));
    }
    const parsed = files.map((f) => ({ file: f, data: parseFrontmatter(readFileSync(join(root, f), 'utf8')).data }));
    const ruleIds = new Set(parsed.map((p) => p.data?.ruleId).filter(Boolean));
    for (const p of parsed) {
      if (seenDirs.has(p.file)) continue;
      seenDirs.add(p.file);
      results.push({ stack, file: p.file, ruleId: p.data?.ruleId ?? null, ...validateRule(p.data, { file: p.file, ruleIds }) });
    }
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const results = validateAll();
  const bad = results.filter((r) => r.errors.length || r.warnings.length);
  if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  else {
    for (const r of bad) {
      process.stdout.write(`${r.file}\n`);
      for (const e of r.errors) process.stdout.write(`  ✗ ${e}\n`);
      for (const w of r.warnings) process.stdout.write(`  ! ${w}\n`);
    }
    const n = results.reduce((a, r) => a + r.errors.length, 0);
    process.stdout.write(`규칙 ${results.length}개 · 오류 ${n} · 경고 ${results.reduce((a, r) => a + r.warnings.length, 0)}\n`);
  }
  process.exit(results.some((r) => r.errors.length) ? 1 : 0);
}
