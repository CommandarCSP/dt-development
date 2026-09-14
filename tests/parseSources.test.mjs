import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSources } from '../scripts/parseSources.mjs';

test('parseSources: 명시적 타입 지정 (--source type:locator)', () => {
  const result = parseSources(['--source', 'markdown:./req.md']);
  assert.deepEqual(result.sources, [{ type: 'markdown', locator: './req.md' }]);
});

test('parseSources: 명시적 타입 지정 (positional type:locator)', () => {
  const result = parseSources(['figma:235:1412']);
  assert.deepEqual(result.sources, [{ type: 'figma', locator: '235:1412' }]);
});

test('parseSources: 마크다운 파일 확장자로 타입 감지 (.md)', () => {
  const result = parseSources(['./requirements.md']);
  assert.deepEqual(result.sources, [{ type: 'markdown', locator: './requirements.md' }]);
});

test('parseSources: 마크다운 파일 확장자로 타입 감지 (.markdown)', () => {
  const result = parseSources(['./doc.markdown']);
  assert.deepEqual(result.sources, [{ type: 'markdown', locator: './doc.markdown' }]);
});

test('parseSources: 텍스트 파일 확장자로 타입 감지 (.txt)', () => {
  const result = parseSources(['./notes.txt']);
  assert.deepEqual(result.sources, [{ type: 'markdown', locator: './notes.txt' }]);
});

test('parseSources: PDF 파일 확장자로 타입 감지 (.pdf)', () => {
  const result = parseSources(['./spec.pdf']);
  assert.deepEqual(result.sources, [{ type: 'pdf', locator: './spec.pdf' }]);
});

test('parseSources: Figma URL로 타입 감지', () => {
  const result = parseSources(['https://figma.com/design/abc123/File']);
  assert.deepEqual(result.sources, [{ type: 'figma', locator: 'https://figma.com/design/abc123/File' }]);
});

test('parseSources: Notion URL로 타입 감지 (web)', () => {
  const result = parseSources(['https://notion.so/workspace/Page']);
  assert.deepEqual(result.sources, [{ type: 'web', locator: 'https://notion.so/workspace/Page' }]);
});

test('parseSources: Atlassian URL로 타입 감지 (web)', () => {
  const result = parseSources(['https://myspace.atlassian.net/wiki/spaces/proj']);
  assert.deepEqual(result.sources, [{ type: 'web', locator: 'https://myspace.atlassian.net/wiki/spaces/proj' }]);
});

test('parseSources: 일반 HTTP URL로 타입 감지 (web)', () => {
  const result = parseSources(['https://example.com/doc']);
  assert.deepEqual(result.sources, [{ type: 'web', locator: 'https://example.com/doc' }]);
});

test('parseSources: 순수 노드 ID (^\d+:\d+$)로 타입 감지 (figma)', () => {
  const result = parseSources(['235:1412']);
  assert.deepEqual(result.sources, [{ type: 'figma', locator: '235:1412' }]);
});

test('parseSources: @role 파싱 - figma', () => {
  const result = parseSources(['235:1412@design']);
  assert.deepEqual(result.sources, [{ type: 'figma', locator: '235:1412', role: 'design' }]);
});

test('parseSources: @role 파싱 - wireframe', () => {
  const result = parseSources(['235:1412@wireframe']);
  assert.deepEqual(result.sources, [{ type: 'figma', locator: '235:1412', role: 'wireframe' }]);
});

test('parseSources: @role 파싱 - 마크다운 파일 (role 무시)', () => {
  const result = parseSources(['./req.md@design']);
  assert.deepEqual(result.sources, [{ type: 'markdown', locator: './req.md' }]);
});

test('parseSources: @role 파싱 - URL (role 무시)', () => {
  const result = parseSources(['https://example.com/doc@wireframe']);
  assert.deepEqual(result.sources, [{ type: 'web', locator: 'https://example.com/doc' }]);
});

test('parseSources: type:locator에서 locator가 콜론 포함 (첫 콜론으로 분리)', () => {
  const result = parseSources(['markdown:./weird:name.txt']);
  assert.deepEqual(result.sources, [{ type: 'markdown', locator: './weird:name.txt' }]);
});

test('parseSources: 여러 소스 혼합', () => {
  const result = parseSources(['235:1412@design', './req.md', 'https://notion.so/page']);
  assert.deepEqual(result.sources, [
    { type: 'figma', locator: '235:1412', role: 'design' },
    { type: 'markdown', locator: './req.md' },
    { type: 'web', locator: 'https://notion.so/page' }
  ]);
});

test('parseSources: --source 플래그 anywhere in args', () => {
  const result = parseSources(['235:1412', '--source', './req.md', 'https://example.com']);
  assert.deepEqual(result.sources, [
    { type: 'figma', locator: '235:1412' },
    { type: 'markdown', locator: './req.md' },
    { type: 'web', locator: 'https://example.com' }
  ]);
});

test('parseSources: 경로 우선 감지 - Windows 경로 (백슬래시) PDF', () => {
  const result = parseSources(['C:\\Users\\project\\spec.pdf']);
  assert.deepEqual(result.sources, [{ type: 'pdf', locator: 'C:\\Users\\project\\spec.pdf' }]);
});

test('parseSources: 경로 우선 감지 - 상대경로 마크다운', () => {
  const result = parseSources(['../docs/design.md']);
  assert.deepEqual(result.sources, [{ type: 'markdown', locator: '../docs/design.md' }]);
});

test('parseSources: 경로 우선 감지 - ./a.md는 figma 노드 아님', () => {
  const result = parseSources(['./a.md']);
  assert.deepEqual(result.sources, [{ type: 'markdown', locator: './a.md' }]);
});

test('parseSources: Figma URL이 figma 노드보다 우선', () => {
  const result = parseSources(['https://figma.com/design/abc/File?node-id=235:1412']);
  assert.deepEqual(result.sources, [{ type: 'figma', locator: 'https://figma.com/design/abc/File?node-id=235:1412' }]);
});

test('parseSources: 기수 검증 - figma design 1개는 OK', () => {
  const result = parseSources(['235:1412@design', './req.md']);
  assert.deepEqual(result.sources.filter(s => s.type === 'figma' && s.role === 'design').length, 1);
});

test('parseSources: 기수 검증 - figma design 2개는 에러', () => {
  assert.throws(
    () => parseSources(['235:1412@design', '678:9012@design']),
    /Figma 디자인 노드는 1개만 지원합니다/
  );
});

test('parseSources: 기수 검증 - figma wireframe 2개는 에러', () => {
  assert.throws(
    () => parseSources(['235:1412@wireframe', '678:9012@wireframe']),
    /Figma 와이어프레임 노드는 1개만 지원합니다/
  );
});

test('parseSources: 기수 검증 - role 없는 figma는 기수에 포함 안 함', () => {
  const result = parseSources(['235:1412', '678:9012']);
  assert.equal(result.sources.length, 2);
});

test('parseSources: 빈 입력 에러', () => {
  assert.throws(
    () => parseSources([]),
    /소스가 없습니다/
  );
});

test('parseSources: --source만 있고 locator 없음 에러', () => {
  assert.throws(
    () => parseSources(['--source']),
    /소스가 없습니다/
  );
});

test('parseSources: 알 수 없는 타입 에러', () => {
  assert.throws(
    () => parseSources(['unknown-source']),
    /소스 타입을 알 수 없습니다/
  );
});

test('parseSources: 알 수 없는 타입 에러 메시지에 locator 포함', () => {
  try {
    parseSources(['weird-name']);
    assert.fail('Should throw');
  } catch (e) {
    assert(e.message.includes('weird-name'));
  }
});
