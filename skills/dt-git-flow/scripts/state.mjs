import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../../../scripts/lib/config.mjs';
import { resolveGitFlow } from '../../../scripts/gitFlow.mjs';

// 내부: git 실행 후 stdout 반환. 실패 시 throw.
function git(repoRoot, args) {
  const r = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  if (r.error) {
    // git 바이너리 미설치(ENOENT) 등 spawn 자체 실패 — status는 null이라 메시지가 비어버리므로 별도 처리.
    throw new Error(`git ${args.join(' ')} spawn failed: ${r.error.message}`);
  }
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || '').trim()}`);
  }
  return r.stdout;
}

export function currentBranch(repoRoot) {
  return git(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
}

// untracked 파일(?? )도 dirty로 본다 — finish 전 깨끗한 트리를 요구하기 위함.
export function isDirty(repoRoot) {
  return git(repoRoot, ['status', '--porcelain']).trim().length > 0;
}

export function rebaseInProgress(repoRoot) {
  const gitDir = resolve(repoRoot, git(repoRoot, ['rev-parse', '--git-dir']).trim());
  return (
    existsSync(join(gitDir, 'rebase-merge')) ||
    existsSync(join(gitDir, 'rebase-apply'))
  );
}

// base...HEAD 의 --left-right --count 는 "<behind><whitespace><ahead>" 를 출력한다(\s+로 분리).
export function aheadBehind(repoRoot, base = 'origin/main') {
  const out = git(repoRoot, ['rev-list', '--left-right', '--count', `${base}...HEAD`]).trim();
  const [behind, ahead] = out.split(/\s+/).map((n) => Number(n));
  return { ahead, behind };
}

// origin 에 해당 브랜치가 있는지 ls-remote 로 권위 있게 확인한다(로컬 추적 ref 의존 X).
export function remoteBranchExists(repoRoot, branch, remote = 'origin') {
  return git(repoRoot, ['ls-remote', '--heads', remote, branch]).trim().length > 0;
}

// base ref 가 존재하면 aheadBehind, 없으면 null.
function safeAheadBehind(repoRoot, base) {
  try {
    return aheadBehind(repoRoot, base);
  } catch {
    return null;
  }
}

// base 는 원격 기준 ref(예: origin/develop). baseBranch 는 그 브랜치 이름 — 기준 브랜치 위에 있는지(isBase) 판단에 쓴다.
export function gitState(repoRoot, base = 'origin/main', baseBranch = base.replace(/^[^/]+\//, '')) {
  const branch = currentBranch(repoRoot);
  return {
    currentBranch: branch,
    baseBranch,
    isBase: branch === baseBranch,
    isMain: branch === 'main', // 옛 이름 — 0.16.x 동안 남긴다. 스킬은 isBase 를 본다.
    detached: branch === 'HEAD',
    dirty: isDirty(repoRoot),
    rebaseInProgress: rebaseInProgress(repoRoot),
    aheadBehind: safeAheadBehind(repoRoot, base),
  };
}

// CLI: node state.mjs [base] → JSON 출력. base 를 안 주면 .dt.json 의 gitFlow.baseBranch(기본 main)로 origin/<base>.
// pathToFileURL로 비교해 공백/비ASCII 경로에서도 가드가 정확히 매치되게 한다.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let base = process.argv[2];
    let baseBranch;
    if (!base) {
      const flow = resolveGitFlow(loadConfig(process.cwd()).config);
      base = flow.baseRef;
      baseBranch = flow.baseBranch;
    }
    process.stdout.write(JSON.stringify(gitState(process.cwd(), base, baseBranch), null, 2) + '\n');
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
