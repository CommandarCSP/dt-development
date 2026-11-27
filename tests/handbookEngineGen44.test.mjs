// 핸드북 정적 축 엔진(GEN-44) — 별칭·워크스페이스 패키지 import, 브라우저 저장 쓰기 지점. 실제 프로젝트 확인 실행에서 빗나간 것들.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { buildDepGraph } from '../scripts/depGraph.mjs';
import { collectWriteSites } from '../scripts/writeSites.mjs';

const project = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'hb-eng-'));
  for (const [rel, text] of Object.entries(files)) { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); }
  return root;
};

test('import — tsconfig paths 별칭(주석·끝 쉼표 있는 tsconfig)과 워크스페이스 패키지를 저장소 안 파일로 푼다', () => {
  const root = project({
    'package.json': '{"name":"mono","private":true}',
    'apps/web/tsconfig.app.json': '{\n  // 앱 설정\n  "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["./src/*"], }, },\n}',
    'apps/web/src/App.tsx': "import { flow } from '@/business/flow';\nimport { Tree } from '@acme/tree';\nimport { join } from '@acme/tree/paths';\nimport React from 'react';",
    'apps/web/src/business/flow.ts': 'export const flow = 1;',
    'packages/tree/package.json': '{"name":"@acme/tree","exports":{".":{"source":"./src/index.ts","import":"./dist/index.js"}}}',
    'packages/tree/src/index.ts': 'export const Tree = 1;',
    'packages/tree/src/paths.ts': 'export const join = 1;',
    'packages/other/src/x.ts': "import { flow } from '@/business/flow';", // 별칭 범위 밖 — 풀지 않는다
  });
  const { edges } = buildDepGraph(root);
  const from = (f) => edges.filter(([a]) => a === f).map(([, b]) => b).sort();
  assert.deepEqual(from('apps/web/src/App.tsx'), ['apps/web/src/business/flow.ts', 'packages/tree/src/index.ts', 'packages/tree/src/paths.ts']);
  assert.deepEqual(from('packages/other/src/x.ts'), [], '별칭은 그 tsconfig 폴더 아래 파일에만 쓴다');
});

test('쓰기 지점 — Zustand 필드마다, IndexedDB 저장소, Web Storage, 테스트 파일은 뺀다', () => {
  const root = project({
    'src/flows/open.ts': "store.setState({ phase: 'opening', saveStatus: 'idle', ...rest });\ntx.objectStore('files').clear();\ndb.put('workspace', meta, KEY);",
    'src/flows/restore.ts': "store.setState({ saveStatus: 'saved' });\nset((s) => ({ ...s }));",
    'src/services/theme.ts': "localStorage.setItem('theme', value);\nstorage.removeItem(THEME_KEY);\nmap.delete('x');",
    'src/flows/__tests__/open.test.ts': "store.setState({ phase: 'x' });\ndb.put('workspace', {});",
  });
  const { byTarget, multiOwner } = collectWriteSites(root);
  assert.deepEqual(byTarget['store:saveStatus'].sort(), ['src/flows/open.ts', 'src/flows/restore.ts']);
  assert.deepEqual(byTarget['store:phase'], ['src/flows/open.ts'], '테스트 파일은 주인이 아니다');
  assert.equal(byTarget['store:rest'], undefined, '펼침(...)은 필드가 아니다');
  assert.deepEqual(byTarget['store:state'], ['src/flows/restore.ts']);
  assert.deepEqual(byTarget['idb:files'], ['src/flows/open.ts']);
  assert.deepEqual(byTarget['idb:workspace'], ['src/flows/open.ts']);
  assert.ok(byTarget['storage:theme'] && byTarget['storage:THEME_KEY']);
  assert.equal(Object.keys(byTarget).some((k) => k.includes('x')), false, 'map.delete 같은 일반 호출은 잡지 않는다');
  assert.deepEqual(multiOwner, ['store:saveStatus']);
});
