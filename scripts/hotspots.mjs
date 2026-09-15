/**
 * 핫스팟 — git 변경 빈도와 함께 바뀌는 파일 쌍. "복잡한 데가 어디냐"의 객관적 근거.
 * 소비처: /dt-handbook analyze(4·8장, 시나리오 순위 가산점).
 * 이력이 없으면 비운다 — 없는 값을 추측하지 않는다.
 */
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';

const defaultRunGit = (root) => (args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

/** 한 커밋에서 이보다 많은 파일이 바뀌었으면 쌍 통계에서 뺀다(포맷·이관 커밋이 통계를 오염시킨다). */
const BULK_COMMIT_FILES = 12;

export function collectHotspots(root, { sinceMonths = 12, runGit } = {}) {
  const git = runGit ?? defaultRunGit(root);
  let raw;
  try {
    raw = git(['log', `--since=${sinceMonths}.months`, '--name-only', '--pretty=format:']);
  } catch (e) {
    return {
      available: false,
      reason: `git 이력을 읽지 못했다: ${String(e.message ?? e).split('\n')[0]}`,
      files: [], coChange: [],
    };
  }

  const commits = raw.split(/\n\s*\n/)
    .map((b) => b.split('\n').map((s) => s.trim()).filter(Boolean))
    .filter((c) => c.length > 0);
  if (commits.length === 0) {
    return { available: false, reason: 'git 이력이 비어 있다(얕은 클론일 수 있다)', files: [], coChange: [] };
  }

  const count = new Map();
  const pairs = new Map();
  for (const c of commits) {
    const uniq = [...new Set(c)];
    for (const f of uniq) count.set(f, (count.get(f) ?? 0) + 1);
    if (uniq.length > BULK_COMMIT_FILES) continue;
    for (let i = 0; i < uniq.length; i++) {
      for (let j = i + 1; j < uniq.length; j++) {
        const k = [uniq[i], uniq[j]].sort().join(' ');
        pairs.set(k, (pairs.get(k) ?? 0) + 1);
      }
    }
  }

  const sizeOf = (f) => { try { return statSync(join(root, f)).size; } catch { return 0; } };
  const files = [...count.entries()]
    .map(([file, commitCount]) => ({ file, commits: commitCount, size: sizeOf(file) }))
    .filter((f) => f.size > 0) // 지워진 파일은 뺀다
    .map((f) => ({ ...f, score: Number((f.commits * Math.log10(f.size + 10)).toFixed(2)) }))
    .sort((a, b) => b.commits - a.commits || b.size - a.size);

  const coChange = [...pairs.entries()]
    .filter(([, n]) => n >= 2)
    .map(([k, n]) => ({ pair: k.split(' '), count: n }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  return { available: true, files: files.slice(0, 50), coChange };
}
