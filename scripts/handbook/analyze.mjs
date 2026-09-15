/**
 * 정적 축 조립 — 진입점·군집·데이터 주인·핫스팟을 하나의 structure.json 으로.
 * 소비처: handbook-analyst 워커(판단), scripts/handbook/gate.mjs(G9 신선도).
 * 여기서 판단하지 않는다 — 사실과 점수만 낸다.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectEntrypoints } from '../entrypoints.mjs';
import { buildDepGraph } from '../depGraph.mjs';
import { collectWriteSites } from '../writeSites.mjs';
import { collectHotspots } from '../hotspots.mjs';

/** 진입점에서 몇 홉까지 따라가 "이 흐름이 건드리는 범위"로 볼지. 2홉이면 진입→서비스→저장소가 잡힌다. */
const HOP = 2;
/** 핫스팟 상위 이 안에 드는 파일에 닿으면 가산점을 준다. */
const HOT_TOP = 10;
const HOT_BONUS = 3;
/**
 * 종류별 가중치 — 도달 파일 수만으로 줄을 세우면 무엇이든 다 부르는 진입 파일(앱 기동부)이
 * 늘 1등이 된다. 앱 수명주기 이벤트(activate·before-quit)는 사용자가 겪는 흐름이 아니므로
 * 눌러 둔다. 판단은 워커가 하고, 이 값은 후보를 보여 주는 순서일 뿐이다.
 */
const KIND_WEIGHT = { ipc: 1, http: 1, route: 1, cli: 1, event: 0.3 };

function reachable(edges, from, hops) {
  const adj = new Map();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push(b);
  }
  const seen = new Set([from]);
  let frontier = [from];
  for (let h = 0; h < hops; h++) {
    const next = [];
    for (const f of frontier) for (const t of adj.get(f) ?? []) if (!seen.has(t)) { seen.add(t); next.push(t); }
    frontier = next;
  }
  return seen;
}

export function analyzeStructure(root, { sinceMonths = 12, runGit, headCommit } = {}) {
  root = resolve(root);
  const { entrypoints } = collectEntrypoints(root);
  const { edges, clusters } = buildDepGraph(root);
  const { byTarget, multiOwner } = collectWriteSites(root);
  const hotspots = collectHotspots(root, { sinceMonths, runGit });

  let baseCommit = headCommit ?? null;
  if (!baseCommit) {
    try { baseCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); }
    catch { baseCommit = null; }
  }

  const hotTop = new Set((hotspots.files ?? []).slice(0, HOT_TOP).map((f) => f.file));
  const flowCandidates = entrypoints.map((e) => {
    const reach = reachable(edges, e.file, HOP);
    const hot = [...reach].some((f) => hotTop.has(f));
    const raw = reach.size + (hot ? HOT_BONUS : 0);
    const weight = KIND_WEIGHT[e.kind] ?? 1;
    return {
      ...e,
      score: Number((raw * weight).toFixed(1)),
      why: `${HOP}홉 ${reach.size}파일${hot ? ', 핫스팟 포함' : ''}${weight === 1 ? '' : ', 수명주기 이벤트라 낮춤'}`,
    };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const structure = {
    baseCommit,
    analyzedAt: new Date().toISOString(),
    entrypoints, clusters, edges,
    data: { byTarget, multiOwner },
    hotspots,
    flowCandidates,
  };

  const dir = join(root, 'docs', 'handbook');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'structure.json'), `${JSON.stringify(structure, null, 2)}\n`, 'utf8');
  return structure;
}

// ── CLI ───────────────────────────────────────────────────────────────
const isMain = (() => {
  try { return process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
})();
if (isMain) {
  const args = process.argv.slice(2);
  const root = args.find((a) => !a.startsWith('--'));
  if (!root) {
    process.stderr.write('Usage: node scripts/handbook/analyze.mjs <projectRoot> [--since-months N]\n');
    process.exit(2);
  }
  const i = args.indexOf('--since-months');
  const s = analyzeStructure(root, { sinceMonths: i === -1 ? 12 : Number(args[i + 1]) });
  process.stdout.write(
    `진입점 ${s.entrypoints.length} · 군집 ${s.clusters.length} · 데이터 대상 ${Object.keys(s.data.byTarget).length}` +
    ` · 주인 둘 이상 ${s.data.multiOwner.length} · 핫스팟 ${s.hotspots.available ? s.hotspots.files.length : '없음'}\n`,
  );
  for (const f of s.flowCandidates.slice(0, 10)) {
    process.stdout.write(`  [${f.score}] ${f.kind} ${f.name} — ${f.why} (${f.file}:${f.line})\n`);
  }
}
