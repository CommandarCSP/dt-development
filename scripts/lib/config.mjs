#!/usr/bin/env node
/**
 * 공통 설정 로더 — `.dt.json`(프로젝트 공통, 커밋) + `.dt.local.json`(개인, 커밋하지 않음).
 *
 * 키마다 뜻·기본값·읽는 곳은 `docs/refs/config-schema.md` 가 단일 출처다. 여기 DEFAULTS 와
 * 그 문서의 키 목록이 같은지는 구조 테스트가 지킨다.
 *
 * 원칙
 * - **설정이 없으면 지금 동작과 같다.** 기본값이 곧 현행 동작이다.
 * - **던지지 않는다.** 파일이 망가졌거나 값이 틀리면 경고를 남기고 기본값을 쓴다.
 *   설정 실수로 스킬·훅이 멈추면 안 된다.
 * - 병합 순서: 기본값 → `.dt-pipeline.json`(옛 훅 설정, hooks 자리) → `.dt.json` → `.dt.local.json`.
 *   객체는 키 단위로 합치고, 배열·값은 뒤가 이긴다.
 *
 * CLI: `node scripts/lib/config.mjs [projectRoot]` → `{ config, warnings, sources }` JSON 을 출력한다.
 * 스킬(문서)은 이 출력을 읽어 값을 쓴다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONFIG_FILE = '.dt.json';
export const LOCAL_CONFIG_FILE = '.dt.local.json';
export const LEGACY_HOOKS_FILE = '.dt-pipeline.json';

export const EXECUTION_MODES = ['ask', 'parallel', 'sequential'];
export const MODEL_NAMES = ['opus', 'sonnet', 'haiku', 'fable'];
export const SUPPORTED_LOCALES = ['ko'];

/**
 * 에이전트 → 모델 티어. `team.models.<tier>` 가 있으면 조율자가 dispatch 때 그 모델로 덮어쓴다.
 * 에이전트를 새로 넣으면 여기에 넣는다(구조 테스트가 빠진 것을 잡는다).
 */
export const AGENT_TIERS = {
  planner: ['definition-author', 'spec-author', 'bespec-author', 'plan-author',
    'guide-analyst', 'guide-author', 'handbook-analyst', 'handbook-tracer', 'handbook-author', 'e2e-author'],
  builder: ['fe-builder', 'be-builder'],
  reviewer: ['reviewer', 'ko-writing-reviewer', 'auditor'],
};

/**
 * 기본값 = 현행 동작.
 * `hooks` 는 null 이 기본이다 — 훅은 opt-in 이라, 설정 파일이 없으면 꺼져 있다(지금과 같다).
 */
export const DEFAULTS = Object.freeze({
  hooks: null,
  team: {
    execution: 'ask',
    models: { planner: null, builder: null, reviewer: null },
    locale: 'ko',
    requiredMcp: [],
  },
});

/** hooks 섹션이 생기면 채우는 기본값(옛 `.dt-pipeline.json` 과 같은 뜻). */
export const HOOK_DEFAULTS = Object.freeze({ enabled: true, commitThreshold: 1, startReminder: true });

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clone = (v) => JSON.parse(JSON.stringify(v));

function merge(base, over) {
  if (!isObj(base) || !isObj(over)) return clone(over);
  const out = clone(base);
  for (const [k, v] of Object.entries(over)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : clone(v);
  return out;
}

function readJson(path, warnings) {
  if (!existsSync(path)) return undefined;
  try {
    const v = JSON.parse(readFileSync(path, 'utf8'));
    if (!isObj(v)) { warnings.push(`${path}: 최상위가 객체가 아니라 무시했습니다`); return undefined; }
    return v;
  } catch (e) {
    warnings.push(`${path}: JSON 을 읽지 못해 무시했습니다 (${e.message})`);
    return undefined;
  }
}

/** 값 검증 — 틀린 값은 경고하고 기본값으로 되돌린다. 모르는 키는 경고만 하고 버린다. */
export function validate(raw, warnings = []) {
  const out = clone(DEFAULTS);
  const known = new Set(Object.keys(DEFAULTS));
  for (const k of Object.keys(raw ?? {})) if (!known.has(k)) warnings.push(`알 수 없는 키 "${k}" — 무시했습니다(docs/refs/config-schema.md)`);

  // hooks
  if (raw?.hooks != null) {
    if (!isObj(raw.hooks)) warnings.push('hooks: 객체여야 합니다 — 무시했습니다');
    else {
      const h = { ...HOOK_DEFAULTS };
      for (const [k, v] of Object.entries(raw.hooks)) {
        if (!(k in HOOK_DEFAULTS)) { warnings.push(`알 수 없는 키 "hooks.${k}" — 무시했습니다`); continue; }
        const ok = k === 'commitThreshold' ? Number.isInteger(v) && v >= 1 : typeof v === 'boolean';
        if (ok) h[k] = v; else warnings.push(`hooks.${k}: 값 ${JSON.stringify(v)} 이 올바르지 않아 기본값 ${JSON.stringify(HOOK_DEFAULTS[k])} 을 씁니다`);
      }
      out.hooks = h;
    }
  }

  // team
  const t = raw?.team;
  if (t != null && !isObj(t)) warnings.push('team: 객체여야 합니다 — 무시했습니다');
  else if (t) {
    for (const k of Object.keys(t)) if (!(k in DEFAULTS.team)) warnings.push(`알 수 없는 키 "team.${k}" — 무시했습니다`);
    if ('execution' in t) {
      if (EXECUTION_MODES.includes(t.execution)) out.team.execution = t.execution;
      else warnings.push(`team.execution: "${t.execution}" 은 ${EXECUTION_MODES.join('|')} 가 아니라 "ask" 를 씁니다`);
    }
    if ('models' in t) {
      if (!isObj(t.models)) warnings.push('team.models: 객체여야 합니다 — 무시했습니다');
      else for (const [tier, m] of Object.entries(t.models)) {
        if (!(tier in DEFAULTS.team.models)) { warnings.push(`알 수 없는 키 "team.models.${tier}" — 무시했습니다`); continue; }
        if (m === null || MODEL_NAMES.includes(m)) out.team.models[tier] = m;
        else warnings.push(`team.models.${tier}: "${m}" 은 ${MODEL_NAMES.join('|')} 가 아니라 에이전트 파일의 모델을 씁니다`);
      }
    }
    if ('locale' in t) {
      if (SUPPORTED_LOCALES.includes(t.locale)) out.team.locale = t.locale;
      else warnings.push(`team.locale: "${t.locale}" 은 아직 지원하지 않아 "ko" 로 진행합니다`);
    }
    if ('requiredMcp' in t) {
      if (Array.isArray(t.requiredMcp) && t.requiredMcp.every((s) => typeof s === 'string' && s.trim())) out.team.requiredMcp = [...new Set(t.requiredMcp.map((s) => s.trim()))];
      else warnings.push('team.requiredMcp: 문자열 배열이어야 합니다 — 무시했습니다');
    }
  }
  return out;
}

/**
 * @param {string} projectRoot
 * @returns {{ config: typeof DEFAULTS, warnings: string[], sources: string[] }}
 */
export function loadConfig(projectRoot) {
  const warnings = [];
  const sources = [];
  let raw = {};
  const legacy = readJson(join(projectRoot, LEGACY_HOOKS_FILE), warnings);
  const main = readJson(join(projectRoot, CONFIG_FILE), warnings);
  const local = readJson(join(projectRoot, LOCAL_CONFIG_FILE), warnings);
  if (legacy) {
    sources.push(LEGACY_HOOKS_FILE);
    raw = merge(raw, { hooks: legacy });
    if (main?.hooks) warnings.push(`${LEGACY_HOOKS_FILE} 와 ${CONFIG_FILE} 의 hooks 가 둘 다 있습니다 — ${CONFIG_FILE} 를 따릅니다. 옛 파일은 지워도 됩니다`);
  }
  if (main) { sources.push(CONFIG_FILE); raw = merge(raw, main); }
  if (local) { sources.push(LOCAL_CONFIG_FILE); raw = merge(raw, local); }
  return { config: validate(raw, warnings), warnings, sources };
}

/** 에이전트 이름 → 덮어쓸 모델(없으면 null = 에이전트 파일의 model 을 쓴다). */
export function modelFor(config, agent) {
  for (const [tier, agents] of Object.entries(AGENT_TIERS)) {
    if (agents.includes(agent)) return config?.team?.models?.[tier] ?? null;
  }
  return null;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? process.cwd());
  process.stdout.write(JSON.stringify(loadConfig(root), null, 2) + '\n');
}
