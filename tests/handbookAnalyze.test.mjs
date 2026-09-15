import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { analyzeStructure } from '../scripts/handbook/analyze.mjs';

const noGit = () => { throw new Error('no git'); };

function project() {
  const root = mkdtempSync(join(tmpdir(), 'an-'));
  const w = (rel, body) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body, 'utf8');
  };
  w('src/ipc.ts', "import { save } from './svc';\nipcMain.handle('doc:save', (_e, p) => save(p));\n");
  w('src/svc.ts', "import { repo } from './repo';\nexport const save = (p) => repo(p);\n");
  w('src/repo.ts', 'export const repo = (p) => prisma.doc.create({ data: p });\n');
  return root;
}

test('structure.json 을 쓰고 필수 열쇠가 다 있다', () => {
  const root = project();
  const s = analyzeStructure(root, { runGit: noGit });
  const p = join(root, 'docs', 'handbook', 'structure.json');
  assert.ok(existsSync(p));
  const onDisk = JSON.parse(readFileSync(p, 'utf8'));
  for (const k of ['baseCommit', 'analyzedAt', 'entrypoints', 'clusters', 'edges', 'data', 'hotspots', 'flowCandidates']) {
    assert.ok(k in onDisk, `${k} 가 없다`);
  }
  assert.equal(s.hotspots.available, false); // git 없음이 결함이 아니다
});

test('시나리오 후보에 점수와 사유가 붙고 점수 내림차순이다', () => {
  const s = analyzeStructure(project(), { runGit: noGit });
  assert.ok(s.flowCandidates.length >= 1);
  const f = s.flowCandidates[0];
  assert.equal(f.name, 'doc:save');
  assert.ok(f.score > 0);
  assert.match(f.why, /홉/);
  const scores = s.flowCandidates.map((c) => c.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

test('2홉 도달 파일 수를 센다', () => {
  const s = analyzeStructure(project(), { runGit: noGit });
  assert.equal(s.flowCandidates[0].score, 3); // ipc → svc → repo
});

test('데이터 주인을 모은다', () => {
  const s = analyzeStructure(project(), { runGit: noGit });
  assert.deepEqual(s.data.byTarget['db:doc'], ['src/repo.ts']);
});

test('핫스팟 상위에 닿는 흐름에 가산점을 준다', () => {
  const root = project();
  const log = ['', 'src/repo.ts', '', 'src/repo.ts'].join('\n');
  const s = analyzeStructure(root, { runGit: () => log });
  assert.equal(s.flowCandidates[0].score, 6); // 3 + 핫스팟 3
  assert.match(s.flowCandidates[0].why, /핫스팟/);
});

test('수명주기 이벤트는 사용자 흐름보다 아래로 내린다', () => {
  const root = project();
  writeFileSync(join(root, 'src', 'lifecycle.ts'),
    "import { save } from './svc';\napp.on('before-quit', () => save());\n", 'utf8');
  const s = analyzeStructure(root, { runGit: noGit });
  const ipc = s.flowCandidates.find((c) => c.kind === 'ipc');
  const ev = s.flowCandidates.find((c) => c.kind === 'event');
  assert.ok(ipc.score > ev.score, `ipc ${ipc.score} 가 event ${ev.score} 보다 높아야 한다`);
  assert.match(ev.why, /낮춤/);
});
