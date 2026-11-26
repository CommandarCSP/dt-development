#!/usr/bin/env node
/**
 * git 흐름 설정과 명령 순서(GEN-12) — `/dt-git start·finish` 와 훅이 같은 값을 쓴다.
 *
 * 설정: `.dt.json` 의 `gitFlow`(기본값 = 예전 고정 정책).
 *   baseBranch    기준 브랜치                               "main"
 *   mergeStrategy no-ff | squash | rebase | pr               "no-ff"
 *   branchPrefix  슬래시 없는 이름에 제안할 접두어, null=제안 안 함  "feat/"
 *   pushPolicy    push=머지 뒤 기준 브랜치 push · none=push 는 사람이   "push"
 * 원격은 origin 으로 고정한다.
 *
 * 이 스크립트는 명령을 **실행하지 않는다**. 순서(계획)만 낸다 — 스킬이 미리보기로 보이고 승인받은 뒤 한 단계씩 실행한다.
 *
 * CLI
 *   node scripts/gitFlow.mjs config [--project <dir>]
 *   node scripts/gitFlow.mjs start  --name <이름> [--project <dir>]
 *   node scripts/gitFlow.mjs finish --feature <브랜치> [--message <머지 메시지>] [--behind <n>] [--project <dir>]
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './lib/config.mjs';
import { resolveGitWeb, compareUrl, originRemote } from './gitWebUrl.mjs';

export const REMOTE = 'origin';
export const MESSAGE_PLACEHOLDER = '<머지 메시지>';

/** @param {{ gitFlow?: object }} config loadConfig().config */
export function resolveGitFlow(config) {
  const g = config?.gitFlow ?? {};
  const baseBranch = g.baseBranch ?? 'main';
  return {
    baseBranch,
    mergeStrategy: g.mergeStrategy ?? 'no-ff',
    branchPrefix: g.branchPrefix === undefined ? 'feat/' : g.branchPrefix,
    pushPolicy: g.pushPolicy ?? 'push',
    remote: REMOTE,
    baseRef: `${REMOTE}/${baseBranch}`,
  };
}

/** start — 이름을 그대로 쓰고, 슬래시가 없으면 접두어를 한 번 제안만 한다. */
export function startPlan(flow, name) {
  const branch = String(name ?? '').trim();
  if (!branch) throw new Error('브랜치 이름이 필요하다');
  if (branch === flow.baseBranch) throw new Error(`기준 브랜치(${flow.baseBranch})와 같은 이름은 쓸 수 없다`);
  const suggestion = !branch.includes('/') && flow.branchPrefix ? `${flow.branchPrefix}${branch}` : null;
  return {
    branch,
    suggestion,
    steps: [
      { id: 'fetch', cmd: ['git', 'fetch', REMOTE] },
      { id: 'branch', cmd: ['git', 'switch', '-c', branch, flow.baseRef] },
    ],
  };
}

/**
 * finish — 방식별 명령 순서. approve=true 인 단계는 그 단계 직전에 따로 승인받는다(계획 승인과 별도).
 * @param {ReturnType<typeof resolveGitFlow>} flow
 * @param {{ feature: string, message?: string, behind?: number|null, web?: {kind: string|null, webBase: string|null}, tools?: {gh?: boolean, glab?: boolean} }} o
 */
export function finishPlan(flow, { feature, message, behind = null, web = null, tools = {} }) {
  if (!feature) throw new Error('피처 브랜치 이름이 필요하다');
  if (feature === flow.baseBranch) throw new Error(`기준 브랜치(${flow.baseBranch})에서는 finish 를 할 수 없다 — 피처 브랜치에서 실행한다`);
  const { baseBranch: base, baseRef, mergeStrategy: how } = flow;
  const steps = [{ id: 'fetch', cmd: ['git', 'fetch', REMOTE] }];
  // 이미 기준 위에 얹혀 있으면(behind 0) 리베이스를 건너뛴다 — 충돌 뒤 재개도 같은 규칙.
  if (behind !== 0) steps.push({ id: 'rebase', cmd: ['git', 'rebase', baseRef], note: '충돌이 나면 멈추고 사람에게 넘긴다' });

  if (how === 'pr') {
    steps.push({ id: 'push-feature', cmd: ['git', 'push', '--force-with-lease', '-u', REMOTE, feature], note: '피처 브랜치만 push 한다(기준 브랜치는 건드리지 않는다)' });
    const url = web?.kind && web?.webBase ? compareUrl(web, base, feature) : null;
    if (web?.kind === 'github' && tools.gh) steps.push({ id: 'open-pr', cmd: ['gh', 'pr', 'create', '--base', base, '--head', feature, '--fill'] });
    else if (web?.kind === 'gitlab' && tools.glab) steps.push({ id: 'open-pr', cmd: ['glab', 'mr', 'create', '--target-branch', base, '--source-branch', feature, '--fill'] });
    else steps.push({ id: 'open-pr', cmd: null, url, note: url ? '이 주소에서 PR 을 연다' : '호스트를 몰라 PR 주소를 만들 수 없다 — 사람이 호스트에서 연다' });
    return { strategy: how, base, feature, steps, after: '머지와 브랜치 정리는 호스트(PR)에서 한다' };
  }

  // 메시지가 아직 없으면 자리 표시를 넣고 needsMessage 로 알린다 — 스킬이 문장을 만들어 승인받은 뒤 다시 계획을 낸다.
  const needsMessage = !message && how !== 'rebase';
  message = message || MESSAGE_PLACEHOLDER;
  steps.push({ id: 'switch-base', cmd: ['git', 'switch', base] });
  steps.push({ id: 'update-base', cmd: ['git', 'merge', '--ff-only', baseRef], note: '실패하면 로컬 기준 브랜치가 origin 과 갈라진 것 — 멈추고 묻는다' });
  if (how === 'no-ff') steps.push({ id: 'merge', cmd: ['git', 'merge', '--no-ff', '-m', message, feature] });
  else if (how === 'squash') {
    steps.push({ id: 'merge', cmd: ['git', 'merge', '--squash', feature] });
    steps.push({ id: 'commit', cmd: ['git', 'commit', '-m', message] });
  } else if (how === 'rebase') steps.push({ id: 'merge', cmd: ['git', 'merge', '--ff-only', feature] });
  if (flow.pushPolicy === 'push') steps.push({ id: 'push-base', cmd: ['git', 'push', REMOTE, base], note: 'fast-forward push 만. force 는 절대 쓰지 않는다' });
  // squash 는 머지 기록이 남지 않아 -d 가 "머지 안 됨"으로 실패한다 → -D 를 따로 승인받는다.
  if (how === 'squash') steps.push({ id: 'delete-feature', cmd: ['git', 'branch', '-D', feature], approve: true, note: 'squash 로 내용은 들어갔지만 git 은 머지로 보지 않아 강제 삭제(-D)가 필요하다' });
  else steps.push({ id: 'delete-feature', cmd: ['git', 'branch', '-d', feature] });
  return {
    strategy: how,
    base,
    feature,
    needsMessage,
    steps,
    after: flow.pushPolicy === 'push' ? '원격 피처 브랜치가 있으면 지울지 묻는다' : `${base} 는 push 하지 않았다 — 사람이 직접 push 한다`,
  };
}

const has = (bin) => spawnSync(bin, ['--version'], { stdio: 'ignore' }).status === 0;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined; };
  const root = resolve(opt('--project') ?? process.cwd());
  const { config, warnings } = loadConfig(root);
  const flow = resolveGitFlow(config);
  try {
    let out;
    if (cmd === 'config') out = { ...flow, warnings };
    else if (cmd === 'start') out = { ...startPlan(flow, opt('--name')), warnings };
    else if (cmd === 'finish') {
      const behind = opt('--behind');
      let web = null;
      if (flow.mergeStrategy === 'pr') { try { web = resolveGitWeb({ remote: originRemote(root) }); } catch { web = null; } }
      const tools = flow.mergeStrategy === 'pr' ? { gh: has('gh'), glab: has('glab') } : {};
      out = { ...finishPlan(flow, { feature: opt('--feature'), message: opt('--message'), behind: behind === undefined ? null : Number(behind), web, tools }), warnings };
    } else {
      process.stderr.write('사용법: gitFlow.mjs config|start|finish [--project <dir>] …\n');
      process.exit(2);
    }
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }
}
