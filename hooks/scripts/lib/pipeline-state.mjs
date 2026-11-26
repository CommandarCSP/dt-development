import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadConfig } from '../../../scripts/lib/config.mjs';
import { resolveWrapSteps, loadWrapBaselines } from '../../../scripts/wrapState.mjs';

// 한글은 부분문자열(공백 토큰화가 약함), 영문은 단어 경계로 매칭한다.
// 영문을 부분문자열로 보면 add∈address, fix∈prefix, bug∈debug 같은 오탐이 난다.
const IMPL_KEYWORDS_KO = ['구현', '추가', '만들', '고쳐', '수정', '기능', '버그', '리팩터'];
const IMPL_KEYWORDS_EN = ['implement', 'add', 'fix', 'build', 'refactor', 'feature', 'bug'];

export function isImplementationPrompt(text) {
  if (!text) return false;
  const t = String(text).toLowerCase();
  if (IMPL_KEYWORDS_KO.some((k) => t.includes(k))) return true;
  return IMPL_KEYWORDS_EN.some((k) => new RegExp(`\\b${k}\\b`).test(t));
}

// 설정이 없을 때(기본 jira·confluence)의 단계 이름 — 알림 문구가 예전과 같다.
const DEFAULT_WRAP_LABELS = ['커밋 정리', 'Confluence 문서 판단', 'Jira 동기화'];

// config: 공통 설정의 hooks(.dt.json 또는 옛 .dt-pipeline.json — loadPipelineConfig) 또는 null. 판정은 IO 없이 주어진 값으로만.
// labels: 실제로 돌 마무리 단계 이름(scripts/wrapState.mjs resolveWrapSteps). 꺼진 어댑터 단계는 이미 빠져 있다.
export function decideWrapReminder({ config, unsynced, head, snooze, labels = DEFAULT_WRAP_LABELS }) {
  if (!config || config.enabled === false) return { block: false };
  const threshold = config.commitThreshold ?? 1;
  if (unsynced < threshold) return { block: false };
  if (head && snooze === head) return { block: false };
  const reason =
    `작업 마무리 게이트 — 정리 안 된 작업 ${unsynced}커밋 감지. 사용자에게 다음을 확인하세요: ` +
    `① main 머지 + origin push 여부 (/dt-git finish — 자동 금지, 매번 사용자 승인). ` +
    `② 마무리 루틴 /dt-wrap (${labels.join(' → ')}). ` +
    `둘 다 사용자가 선택하게 하고, 건너뛰려면 "넘어가"라고 하세요.`;
  return { block: true, reason };
}

export function decideStartReminder({ config, branch, prompt }) {
  if (!config || config.enabled === false || config.startReminder === false) {
    return { inject: false };
  }
  if (branch !== 'main') return { inject: false };
  if (!isImplementationPrompt(prompt)) return { inject: false };
  const context =
    '현재 main 브랜치입니다. 새 구현 작업이면 /dt-git start <이름>로 ' +
    '피처 브랜치를 먼저 분기하는 걸 권장합니다.';
  return { inject: true, context };
}

// spawn 실패(ENOENT 등)면 r.status는 null이라 호출부의 `r.status === 0`이 안전하게 false가 된다.
// 즉 git 미설치/실패는 전부 안전 기본값으로 떨어지며, hook은 절대 throw하지 않는다.
function git(repoRoot, args) {
  return spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
}

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// 훅 설정 = 공통 설정(.dt.json)의 hooks. 옛 .dt-pipeline.json 도 로더가 hooks 자리로 읽는다(하위 호환).
// 둘 다 없으면 null — 훅은 opt-in 이라 꺼진다. 로더는 던지지 않으니 hook 도 안전하다.
export function loadPipelineConfig(repoRoot) {
  try {
    return loadConfig(repoRoot).config.hooks;
  } catch {
    return null;
  }
}

export function loadLastSyncSha(repoRoot) {
  const local = loadJson(join(repoRoot, '.dt-worklog.local.json'));
  return local && typeof local.lastSyncSha === 'string' ? local.lastSyncSha : null;
}

/** 훅 기준점 — `/dt-wrap` 이 남긴 lastWrapSha 와 `/dt-worklog` 이 남긴 lastSyncSha(GEN-11). */
export function loadBaselines(repoRoot) {
  const b = loadWrapBaselines(repoRoot);
  return [b.lastWrapSha, b.lastSyncSha].filter(Boolean);
}

/** 알림 문구에 넣을 단계 이름. 설정을 못 읽으면 기본 단계. */
export function loadWrapLabels(repoRoot) {
  try {
    return resolveWrapSteps(loadConfig(repoRoot).config).labels;
  } catch {
    return DEFAULT_WRAP_LABELS;
  }
}

export function currentBranch(repoRoot) {
  const r = git(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return r.status === 0 ? r.stdout.trim() : null;
}

export function headSha(repoRoot) {
  const r = git(repoRoot, ['rev-parse', 'HEAD']);
  return r.status === 0 ? r.stdout.trim() : null;
}

// 기준점 이후 커밋 수. 기준점이 여럿이면(lastWrapSha·lastSyncSha) 가장 적게 세는 것 = 가장 최근 것을 쓴다.
// 기준점이 dangling(force-push/gc)이면 그것은 빼고, 다 실패하면 origin/main으로 폴백
// 한다 — 그렇지 않으면 넛지가 영구 침묵해 버린다. 전부 실패하면 0(침묵).
function countRange(repoRoot, range) {
  const r = git(repoRoot, ['rev-list', '--count', range]);
  if (r.status !== 0) return null;
  const n = Number(r.stdout.trim());
  return Number.isFinite(n) ? n : null;
}

export function unsyncedCommitCount(repoRoot, ...baselines) {
  const counts = baselines.flat()
    .filter(Boolean)
    .map((sha) => countRange(repoRoot, `${sha}..HEAD`))
    .filter((n) => n !== null);
  if (counts.length) return Math.min(...counts);
  // 기준점이 없거나 모두 조회 실패 → origin/main 기준으로 폴백
  return countRange(repoRoot, 'origin/main..HEAD') ?? 0;
}

function snoozePath(repoRoot) {
  const r = git(repoRoot, ['rev-parse', '--git-dir']);
  if (r.status !== 0) return null;
  return join(resolve(repoRoot, r.stdout.trim()), 'dt-wrap-snooze');
}

export function readSnooze(repoRoot) {
  const p = snoozePath(repoRoot);
  if (!p || !existsSync(p)) return null;
  try {
    return readFileSync(p, 'utf8').trim();
  } catch {
    return null;
  }
}

export function writeSnooze(repoRoot, sha) {
  const p = snoozePath(repoRoot);
  if (!p) return;
  try {
    writeFileSync(p, sha + '\n');
  } catch {
    /* 무시: 스누즈 실패는 치명적이지 않음 */
  }
}

/**
 * 산출물 형식 알림(GEN-25) — 훅이 켜져 있고 dt 명령(`/dt-…`)을 시작할 때만, 옮길 산출물이 있으면 한 줄 알린다.
 * 판정은 scripts/migrate.mjs scan. 실패해도 조용히 넘어간다(훅이 작업을 막으면 안 된다).
 * @param {{ config: object|null, prompt: string, scanFn: (root: string) => {status: string}[], repoRoot: string }} p
 */
export function decideSchemaNotice({ config, prompt, scanFn, repoRoot }) {
  if (!config || config.enabled === false) return { inject: false };
  if (!/^\s*\/dt-(?!migrate\b)/.test(prompt || '')) return { inject: false };
  let found;
  try { found = scanFn(repoRoot); } catch { return { inject: false }; }
  const migrate = found.filter((f) => f.status === 'migrate').length;
  const newer = found.filter((f) => f.status === 'newer').length;
  if (!migrate && !newer) return { inject: false };
  const parts = [];
  if (migrate) parts.push(`옛 형식 산출물 ${migrate}개(옮길 수 있음)`);
  if (newer) parts.push(`플러그인보다 새 형식 ${newer}개(플러그인 업데이트 필요)`);
  return { inject: true, context: `[dt-development] ${parts.join(' · ')} — 사용자에게 한 줄 알리고 /dt-migrate 로 미리보기를 권한다(지금 작업은 막지 않는다).` };
}
