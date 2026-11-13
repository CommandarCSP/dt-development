#!/usr/bin/env node
/**
 * 정의서 버전 판단 — 계약이 바뀔 때만 definitionVersion 을 올린다(GEN-24).
 * 문구만 고쳐도 버전이 오르면, 그 정의서를 근거로 한 스펙(basedOnDefinition@vN)이 전부 stale 로 뜬다.
 *
 * 계약 해시 = 전역 규약 절의 내용 줄 + SP·IF·DM 표 행(칸 단위로 공백 정리). HTML 주석·빈 줄·그 밖의 서술은 빠진다.
 *
 * CLI: node scripts/definitionVersion.mjs <기존 definition.md> <새 초안> [--json]
 *      → { current, next, changed }  (기존 파일이 없으면 next=1)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseDefinitionHeader } from './buildDefinitionHeader.mjs';
import { parseSections } from './lib/sections.mjs';

const norm = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();

export function contractLines(md) {
  const body = md.replace(/<!--[\s\S]*?-->/g, '');
  const rows = (body.match(/^\s*\|\s*(SP|IF|DM)-\d+\s*\|.*$/gm) ?? []).map((r) => r.split('|').map(norm).filter(Boolean).join(' | '));
  const conv = parseSections(body).sections.find((s) => s.key === '전역 규약');
  const convLines = conv ? conv.text.split('\n').slice(1).map(norm).filter((l) => l && !/^#/.test(l)) : [];
  return [...convLines.map((l) => `conv: ${l}`), ...rows.sort()];
}

export const contractHash = (md) => createHash('sha256').update(contractLines(md).join('\n')).digest('hex').slice(0, 8);

export function nextDefinitionVersion(oldMd, newMd) {
  if (!oldMd) return { current: null, next: 1, changed: true };
  const current = parseDefinitionHeader(oldMd)?.definitionVersion ?? 1;
  const changed = contractHash(oldMd) !== contractHash(newMd);
  return { current, next: changed ? current + 1 : current, changed };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [oldPath, newPath] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const oldMd = oldPath && existsSync(oldPath) ? readFileSync(oldPath, 'utf8') : '';
  const r = nextDefinitionVersion(oldMd, readFileSync(newPath, 'utf8'));
  process.stdout.write(JSON.stringify(r) + '\n');
}
