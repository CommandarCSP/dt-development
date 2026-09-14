import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

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

// config: .dt-pipeline.json 내용(또는 null). 판정은 IO 없이 주어진 값으로만.
export function decideWrapReminder({ config, unsynced, head, snooze }) {
  if (!config || config.enabled === false) return { block: false };
  const threshold = config.commitThreshold ?? 1;
  if (unsynced < threshold) return { block: false };
  if (head && snooze === head) return { block: false };
  const reason =
    `작업 마무리 게이트 — 정리 안 된 작업 ${unsynced}커밋 감지. 사용자에게 다음을 확인하세요: ` +
    `① main 머지 + origin push 여부 (/dt-git finish — 자동 금지, 매번 사용자 승인). ` +
    `② 마무리 루틴 /dt-wrap (커밋 정리 → Confluence 문서 판단 → Jira 동기화). ` +
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

export function loadPipelineConfig(repoRoot) {
  return loadJson(join(repoRoot, '.dt-pipeline.json'));
}

export function loadLastSyncSha(repoRoot) {
  const local = loadJson(join(repoRoot, '.dt-worklog.local.json'));
  return local && typeof local.lastSyncSha === 'string' ? local.lastSyncSha : null;
}

export function currentBranch(repoRoot) {
  const r = git(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return r.status === 0 ? r.stdout.trim() : null;
}

export function headSha(repoRoot) {
  const r = git(repoRoot, ['rev-parse', 'HEAD']);
  return r.status === 0 ? r.stdout.trim() : null;
}

// lastSyncSha 이후 커밋 수. lastSyncSha가 dangling(force-push/gc)이면 origin/main으로 폴백
// 한다 — 그렇지 않으면 넛지가 영구 침묵해 버린다. 전부 실패하면 0(침묵).
function countRange(repoRoot, range) {
  const r = git(repoRoot, ['rev-list', '--count', range]);
  if (r.status !== 0) return null;
  const n = Number(r.stdout.trim());
  return Number.isFinite(n) ? n : null;
}

export function unsyncedCommitCount(repoRoot, lastSyncSha) {
  if (lastSyncSha) {
    const n = countRange(repoRoot, `${lastSyncSha}..HEAD`);
    if (n !== null) return n;
    // lastSyncSha 조회 실패 → origin/main 기준으로 폴백
  }
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
