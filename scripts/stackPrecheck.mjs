#!/usr/bin/env node
/**
 * 스택 사전 점검 — 구현·스캐폴드·e2e 를 시작하기 전에, 프로젝트가 플러그인 기본 기술과 어디가 다른지 영역별로 본다.
 * 절차(언제 부르고, 다르면 무엇을 묻고, 어디에 남기는지)는 `docs/refs/stack-precheck.md` 가 단일 출처다.
 *
 * 판정
 *   same      기본과 같다
 *   absent    기본도 대안도 없다 — 플러그인이 새로 깐다(묻지 않고 알린다)
 *   adaptable 대안이 있다 — 프로젝트 방식을 따를 수 있다(묻는다)
 *   blocking  대안이 있는데 플러그인 템플릿·리뷰 규칙이 기본을 전제한다 — 결과를 보장할 수 없다(묻는다)
 *
 * 채택된 PD 중 머리말 `topic` 이 영역 key 와 같은 것이 있으면 그 영역은 이미 정해진 것으로 보고 묻지 않는다.
 *
 * CLI: node scripts/stackPrecheck.mjs <projectRoot> --stack frontend|backend [--json]
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDecisions, isActive } from './decisions.mjs';

/** 영역 정의. expected 중 하나라도 있으면 same, alternatives 중 하나가 있으면 그 판정. */
export const AREAS = {
  frontend: [
    { key: 'stack.fe.framework', label: '프레임워크', expected: ['react'], alternatives: ['vue', 'nuxt', 'svelte', '@sveltejs/kit', '@angular/core', 'solid-js'], onAlt: 'blocking' },
    { key: 'stack.fe.serverState', label: '서버 상태', expected: ['@tanstack/react-query'], alternatives: ['swr', '@apollo/client', 'urql', '@reduxjs/toolkit'], onAlt: 'adaptable' },
    { key: 'stack.fe.clientState', label: '클라이언트 상태', expected: ['zustand'], alternatives: ['@reduxjs/toolkit', 'redux', 'jotai', 'recoil', 'mobx', 'valtio'], onAlt: 'adaptable' },
    { key: 'stack.fe.styling', label: '스타일', expected: ['tailwindcss', '@tailwindcss/vite', '@tailwindcss/postcss'], alternatives: ['sass', 'styled-components', '@emotion/react', '@vanilla-extract/css', '@mui/material', 'antd'], onAlt: 'adaptable' },
    { key: 'stack.fe.router', label: '라우터', expected: ['react-router', 'react-router-dom'], alternatives: ['next', '@tanstack/react-router', 'wouter'], onAlt: 'adaptable' },
    { key: 'stack.fe.unitTest', label: '단위·통합 테스트', expected: ['vitest'], alternatives: ['jest'], onAlt: 'adaptable' },
    { key: 'stack.fe.apiMock', label: 'API mock', expected: ['msw'], alternatives: ['nock', 'axios-mock-adapter', 'fetch-mock'], onAlt: 'adaptable' },
    { key: 'stack.fe.e2e', label: 'e2e', expected: ['@playwright/test', 'playwright'], alternatives: ['cypress', 'webdriverio'], onAlt: 'adaptable' },
  ],
  backend: [
    { key: 'stack.be.framework', label: '프레임워크', expected: ['@nestjs/core'], alternatives: ['express', 'fastify', 'koa', 'hono', '@hapi/hapi'], onAlt: 'blocking' },
    { key: 'stack.be.orm', label: 'ORM', expected: ['@prisma/client', 'prisma'], alternatives: ['typeorm', '@mikro-orm/core', 'sequelize', 'drizzle-orm', 'mongoose', 'knex'], onAlt: 'blocking' },
    { key: 'stack.be.unitTest', label: '단위 테스트', expected: ['jest'], alternatives: ['vitest', 'mocha'], onAlt: 'adaptable' },
    { key: 'stack.be.httpTest', label: 'HTTP 통합 테스트', expected: ['supertest'], alternatives: ['pactum', 'axios'], onAlt: 'adaptable' },
    { key: 'stack.be.testDb', label: '통합 테스트 DB', expected: ['testcontainers', '@testcontainers/postgresql', '@testcontainers/mysql'], alternatives: ['pg-mem', 'sqlite3', 'better-sqlite3'], onAlt: 'adaptable' },
  ],
};

const depsOf = (pkg) => (pkg && typeof pkg === 'object' ? { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) } : {});

/**
 * @param {object} pkg package.json 객체
 * @param {'frontend'|'backend'} stack
 * @param {{ topic?: string, id: string }[]} decisions 채택된 결정(머리말 topic 이 있는 것만 의미 있음)
 */
export function precheck(pkg, stack, decisions = []) {
  if (!AREAS[stack]) throw new Error(`stack 은 frontend|backend: ${stack}`);
  const deps = depsOf(pkg);
  const byTopic = new Map(decisions.filter((d) => d.topic).map((d) => [d.topic, d.id]));
  const areas = AREAS[stack].map((a) => {
    const foundExpected = a.expected.filter((n) => n in deps);
    const foundAlt = a.alternatives.filter((n) => n in deps);
    let status;
    if (foundExpected.length) status = 'same';
    else if (foundAlt.length) status = a.onAlt;
    else status = 'absent';
    return { key: a.key, label: a.label, expected: a.expected[0], found: foundExpected[0] ?? foundAlt[0] ?? null, status, decidedBy: byTopic.get(a.key) ?? null };
  });
  const questions = areas.filter((a) => (a.status === 'adaptable' || a.status === 'blocking') && !a.decidedBy);
  return { stack, areas, questions, blocking: questions.some((q) => q.status === 'blocking') };
}

/** 프로젝트 루트에서 package.json 과 채택된 PD·TP 를 읽어 점검한다. package.json 이 없으면 모든 영역이 absent. */
export function precheckProject(projectRoot, stack) {
  const pkgPath = join(projectRoot, 'package.json');
  let pkg = {};
  if (existsSync(pkgPath)) {
    try { pkg = JSON.parse(readFileSync(pkgPath, 'utf8')); } catch { pkg = {}; }
  }
  const decisions = loadDecisions(projectRoot).filter((d) => isActive(d.meta)).map((d) => ({ id: d.meta.id, topic: d.meta.topic }));
  return precheck(pkg, stack, decisions);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--stack');
  const stack = i >= 0 ? args[i + 1] : 'frontend';
  const root = resolve(args.find((a, j) => !a.startsWith('--') && args[j - 1] !== '--stack') ?? process.cwd());
  const r = precheckProject(root, stack);
  if (args.includes('--json')) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  else {
    for (const a of r.areas) process.stdout.write(`${a.status.padEnd(9)} ${a.label}: 기본 ${a.expected} / 프로젝트 ${a.found ?? '없음'}${a.decidedBy ? ` (정해짐: ${a.decidedBy})` : ''}\n`);
    process.stdout.write(r.questions.length ? `물을 영역 ${r.questions.length}개${r.blocking ? ' — 규칙이 안 맞는 영역 포함' : ''}\n` : '물을 영역 없음\n');
  }
}
