import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectStacks, buildStackConfig } from '../scripts/detectStackConfig.mjs';

// detectStacks: package.json 의 의존성만 보고 어느 스택인지 정한다.
// 디스크를 보지 않는 순수 함수라 픽스처는 객체 하나면 된다.

test('detectStacks: react 의존성이면 frontend', () => {
  assert.deepEqual(detectStacks({ dependencies: { react: '^19.0.0' } }), ['frontend']);
});

test('detectStacks: vite 는 devDependencies 에 있어도 frontend', () => {
  assert.deepEqual(detectStacks({ devDependencies: { vite: '^7.0.0' } }), ['frontend']);
});

test('detectStacks: @nestjs/core 면 backend', () => {
  assert.deepEqual(detectStacks({ dependencies: { '@nestjs/core': '^11.0.0' } }), ['backend']);
});

test('detectStacks: 둘 다 있으면 둘 다 (모노레포 루트 등)', () => {
  const pkg = { dependencies: { react: '^19.0.0', '@nestjs/core': '^11.0.0' } };
  assert.deepEqual(detectStacks(pkg), ['frontend', 'backend']);
});

test('detectStacks: 아는 의존성이 없으면 빈 배열 — 이때는 설정을 만들지 않는다', () => {
  assert.deepEqual(detectStacks({ dependencies: { lodash: '^4.0.0' } }), []);
});

test('detectStacks: package.json 이 없거나 망가져도 던지지 않는다', () => {
  // 감지 실패는 오류가 아니라 "모른다" 다 — 호출부가 설정을 안 만들면 그만이다.
  assert.deepEqual(detectStacks(null), []);
  assert.deepEqual(detectStacks(undefined), []);
  assert.deepEqual(detectStacks({}), []);
});

// buildStackConfig: 감지 결과 + 소스 경로로 설정 객체를 만든다.
// 코드가 실제로 읽는 키는 coverage 와 overrides 뿐이지만(스크립트 확인),
// paths·enabledSkills 는 스킬 문서가 읽으므로 함께 넣는다.

test('buildStackConfig: frontend 설정의 모양', () => {
  const cfg = buildStackConfig('frontend', { srcPath: 'src' });
  assert.equal(cfg.paths.src, 'src');
  assert.equal(cfg.coverage.mode, 'full');
  assert.equal(cfg.coverage.baselineRef, 'HEAD');
  assert.deepEqual(cfg.overrides, {});
  assert.ok(cfg.enabledSkills.includes('dt-frontend-review'));
  assert.ok(cfg.enabledSkills.includes('dt-frontend-architecture'));
});

test('buildStackConfig: backend 는 백엔드 스킬만 켠다', () => {
  const cfg = buildStackConfig('backend', { srcPath: 'src' });
  assert.ok(cfg.enabledSkills.includes('dt-backend-review'));
  assert.ok(!cfg.enabledSkills.some((s) => s.startsWith('dt-frontend-')));
});

test('buildStackConfig: 모노레포처럼 소스 경로가 다르면 그대로 반영한다', () => {
  // 감지가 틀릴 수 있는 자리라 호출부가 사용자에게 보고해야 한다(bootstrap 절차 §3).
  const cfg = buildStackConfig('frontend', { srcPath: 'packages/web/src' });
  assert.equal(cfg.paths.src, 'packages/web/src');
});

test('buildStackConfig: 모르는 스택이면 던진다 — 조용히 빈 설정을 만들지 않는다', () => {
  assert.throws(() => buildStackConfig('mobile', { srcPath: 'src' }), /mobile/);
});

// 템플릿 파일과 buildStackConfig 가 갈리면 한쪽만 고쳐지는 사고가 난다.
// 같은 모양을 두 곳에 두는 이상, 같다는 것을 기계가 지켜야 한다.

test('templates/dt-*.json.tmpl 이 buildStackConfig 결과와 같은 모양이다', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  for (const stack of ['frontend', 'backend']) {
    const tmplPath = fileURLToPath(new URL(`../templates/dt-${stack}.json.tmpl`, import.meta.url));
    const raw = (await readFile(tmplPath, 'utf8')).replace('{{SRC}}', 'src');
    assert.deepEqual(
      JSON.parse(raw),
      buildStackConfig(stack, { srcPath: 'src' }),
      `dt-${stack}.json.tmpl 과 buildStackConfig('${stack}') 가 다르다`,
    );
  }
});
