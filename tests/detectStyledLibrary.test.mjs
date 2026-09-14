import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectStyledLibrary } from '../scripts/detectStyledLibrary.mjs';

test('detectStyledLibrary: antd 있으면 "antd" 반환', () => {
  assert.equal(detectStyledLibrary({ antd: '^5.9.4', react: '^19.0.0' }), 'antd');
});

test('detectStyledLibrary: @mui/material 감지', () => {
  assert.equal(detectStyledLibrary({ '@mui/material': '^6.0.0' }), '@mui/material');
});

test('detectStyledLibrary: allowlist 외(headless 포함)는 null', () => {
  assert.equal(detectStyledLibrary({ 'react-aria-components': '^1.0.0', sass: '^1.0.0' }), null);
});

test('detectStyledLibrary: 빈 객체 / 인자 생략 시 null', () => {
  assert.equal(detectStyledLibrary({}), null);
  assert.equal(detectStyledLibrary(), null);
});

test('detectStyledLibrary: 여러 개 매칭 시 allowlist 순서 우선(antd가 @mui보다 먼저)', () => {
  assert.equal(detectStyledLibrary({ '@mui/material': '^6.0.0', antd: '^5.9.4' }), 'antd');
});

test('detects shadcn via @radix-ui/* dependency', () => {
  assert.equal(detectStyledLibrary({ '@radix-ui/react-dialog': '^1.0.0' }), 'shadcn');
});

test('shadcn takes priority over styled allowlist', () => {
  assert.equal(detectStyledLibrary({ '@radix-ui/react-dialog': '^1', '@mui/material': '^5' }), 'shadcn');
});
