import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkVersions, nextVersion, releaseChangelog, latestChangelogVersion, unreleasedBody, planRelease, PLUGIN_ROOT, CHANGELOG,
} from '../scripts/release.mjs';

test('플러그인: 버전이 적힌 4곳이 같고, CHANGELOG 맨 위 버전 절이 그 버전이다', () => {
  const { version, problems } = checkVersions(PLUGIN_ROOT);
  assert.deepEqual(problems, []);
  const cl = readFileSync(join(PLUGIN_ROOT, CHANGELOG), 'utf8');
  assert.equal(latestChangelogVersion(cl), version, 'release.mjs 로 올리면 둘이 같이 바뀐다');
  assert.notEqual(unreleasedBody(cl), null, 'CHANGELOG 맨 위에 "## [미출시]" 절이 있다');
});

test('nextVersion: patch·minor·major·직접 지정', () => {
  assert.equal(nextVersion('0.14.0', 'patch'), '0.14.1');
  assert.equal(nextVersion('0.14.3', 'minor'), '0.15.0');
  assert.equal(nextVersion('0.14.3', 'major'), '1.0.0');
  assert.equal(nextVersion('0.14.3', '2.0.0'), '2.0.0');
  assert.throws(() => nextVersion('0.14.0', 'big'));
});

test('releaseChangelog: 미출시 절을 버전 절로 바꾸고 빈 미출시 절을 새로 둔다. 비었으면 거절', () => {
  const cl = '# 변경 기록\n\n## [미출시]\n\n### 추가\n- 새 것\n\n## [0.1.0] - 2026-01-01\n- 옛것\n';
  const out = releaseChangelog(cl, '0.2.0', '2026-02-02');
  assert.match(out, /## \[미출시\]\n\n## \[0\.2\.0\] - 2026-02-02\n\n### 추가\n- 새 것/);
  assert.equal(latestChangelogVersion(out), '0.2.0');
  assert.equal(unreleasedBody(out), '');
  assert.throws(() => releaseChangelog(out, '0.3.0', '2026-03-03'), /비었다/);
  assert.throws(() => releaseChangelog('# 기록\n', '0.3.0', '2026-03-03'), /미출시/);
});

test('planRelease: 4곳을 다 바꾸고, 어긋나 있거나 낮은 버전이면 거절한다', () => {
  const root = mkdtempSync(join(tmpdir(), 'dt-rel-'));
  try {
    mkdirSync(join(root, '.claude-plugin'));
    const put = (f, v) => writeFileSync(join(root, f), v);
    put('package.json', '{\n  "name": "x",\n  "version": "1.2.3"\n}\n');
    put('.claude-plugin/plugin.json', '{ "version": "1.2.3" }\n');
    put('.claude-plugin/marketplace.json', '{ "metadata": { "version": "1.2.3" }, "plugins": [{ "version": "1.2.3" }] }\n');
    put(CHANGELOG, '## [미출시]\n- 고침\n\n## [1.2.3] - 2026-01-01\n');
    const plan = planRelease(root, 'minor', { date: '2026-11-16' });
    assert.equal(plan.to, '1.3.0');
    assert.ok(plan.files.every((f) => f.after !== f.before), '5개 파일이 모두 바뀐다');
    assert.equal((plan.files.find((f) => f.file === '.claude-plugin/marketplace.json').after.match(/1\.3\.0/g) || []).length, 2);
    assert.throws(() => planRelease(root, '1.0.0'), /커야/);
    put('.claude-plugin/plugin.json', '{ "version": "1.2.4" }\n');
    assert.throws(() => planRelease(root, 'patch'), /어긋나/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
