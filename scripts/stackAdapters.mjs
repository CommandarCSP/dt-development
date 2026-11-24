#!/usr/bin/env node
/**
 * BE 스택 어댑터(GEN-05) — 프로젝트가 쓰는 ORM·DB·캐시·큐·인증을 고르고, 리뷰 규칙의 빈칸을 채운다.
 * 키 설명은 docs/refs/stack-config.md §4.
 *
 * 순서: 스택 설정 `stack.<영역>` → package.json 의존성(·prisma/schema.prisma provider) → 기본값.
 * 감지는 **대안만** 고른다 — 아무것도 없으면 기본값(prisma·postgresql·redis·bullmq·passport-jwt)이다.
 * `none` 은 설정으로만 정한다(감지가 규칙을 끄지 않는다). 그래서 설정 없는 Prisma 프로젝트의 규칙은 그대로다.
 *
 * 규칙 머리말에서 쓰는 빈칸:
 *   배열 원소 "$orm.<이름>"   → 그 자리에 값 배열을 펼친다(appliesTo·excludePathPatterns·matches·matchArguments)
 *   문자열 안 "{{orm.<이름>}}" → 정규식 조각으로 바꾼다(pattern·when·require·forbid). 값이 비면 그 검출 인자를 뺀다
 *   requiresStack: [orm]      → 그 영역이 none 이면 규칙을 건너뛴다(보고서에 적는다)
 *
 * CLI: node scripts/stackAdapters.mjs [--project <dir>] [--json]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** ORM 어댑터. 키 이름이 규칙 빈칸 이름이다. 배열은 glob, 문자열은 정규식 조각. */
export const ORM_ADAPTERS = {
  prisma: {
    label: 'Prisma',
    packages: ['@prisma/client', 'prisma'],
    imports: ['@prisma/client'], // ORM 클라이언트·생성 타입
    access: ['@prisma/client', '**/prisma.service', '**/prisma/prisma.service'], // 데이터 접근 객체(서비스·컨트롤러가 못 가져온다)
    allowedPaths: ['src/prisma/**', 'src/**/prisma.service.ts'], // ORM 을 가져와도 되는 저장소 밖 자리
    mockTargets: ['**/prisma**', '**/prisma.service', '@prisma/client'], // 통합 테스트에서 mock 하면 안 되는 import
    mockRegex: "jest\\.mock\\(\\s*['\"]@prisma\\/client|mockDeep<\\s*PrismaClient|createMock<\\s*Prisma|PrismaService\\s*,\\s*useValue",
    connectRegex: 'new\\s+PrismaClient\\s*\\(', // 단위 테스트에서 금지하는 실제 연결
  },
  typeorm: {
    label: 'TypeORM',
    packages: ['typeorm', '@nestjs/typeorm'],
    imports: ['typeorm', 'typeorm/**', '@nestjs/typeorm'],
    access: ['typeorm', 'typeorm/**', '@nestjs/typeorm', '**/data-source'],
    allowedPaths: ['src/**/*.entity.ts', 'src/**/entities/**', 'src/**/migrations/**', 'src/**/*.subscriber.ts', 'src/**/data-source.ts', 'src/database/**', 'src/**/*.module.ts'],
    mockTargets: ['typeorm', '@nestjs/typeorm', '**/data-source'],
    mockRegex: "jest\\.mock\\(\\s*['\"](?:typeorm|@nestjs\\/typeorm)['\"]|getRepositoryToken\\([^)]*\\)\\s*,\\s*useValue|(?:createMock|mockDeep)<\\s*(?:Repository|DataSource|EntityManager)\\b",
    connectRegex: 'new\\s+DataSource\\s*\\(',
  },
  drizzle: {
    label: 'Drizzle',
    packages: ['drizzle-orm'],
    imports: ['drizzle-orm', 'drizzle-orm/**'],
    access: ['drizzle-orm', 'drizzle-orm/**', '**/db', '**/db/index', '**/db/schema', '**/database'],
    allowedPaths: ['src/db/**', 'src/database/**', 'src/**/schema.ts', 'src/**/*.schema.ts', 'src/**/*.module.ts'],
    mockTargets: ['drizzle-orm', 'drizzle-orm/**', '**/db', '**/db/**'],
    mockRegex: "jest\\.mock\\(\\s*['\"](?:drizzle-orm|[^'\"]*\\/db)['\"/]",
    connectRegex: '\\bdrizzle\\s*\\(',
  },
  none: { label: '없음', packages: [], imports: [], access: [], allowedPaths: [], mockTargets: [], mockRegex: '', connectRegex: '' },
};

/** 영역별 값·감지. detect 는 [패키지, 값] — 앞에 있는 것이 먼저. 기본값은 첫 값. */
export const AREAS = {
  orm: { values: Object.keys(ORM_ADAPTERS), default: 'prisma', detect: [['@prisma/client', 'prisma'], ['prisma', 'prisma'], ['typeorm', 'typeorm'], ['@nestjs/typeorm', 'typeorm'], ['drizzle-orm', 'drizzle']] },
  db: { values: ['postgresql', 'mysql', 'sqlite', 'mongodb', 'sqlserver', 'none'], default: 'postgresql', detect: [['pg', 'postgresql'], ['postgres', 'postgresql'], ['mysql2', 'mysql'], ['mysql', 'mysql'], ['better-sqlite3', 'sqlite'], ['sqlite3', 'sqlite'], ['mongodb', 'mongodb'], ['mssql', 'sqlserver']] },
  cache: { values: ['redis', 'none'], default: 'redis', detect: [] },
  queue: { values: ['bullmq', 'bull', 'none'], default: 'bullmq', detect: [['bullmq', 'bullmq'], ['@nestjs/bullmq', 'bullmq'], ['bull', 'bull'], ['@nestjs/bull', 'bull']] },
  auth: { values: ['passport-jwt', 'other', 'none'], default: 'passport-jwt', detect: [] },
};

/** DB 별 Testcontainers 모듈 — be-builder·e2e 작성 에이전트가 읽는다. sqlite 는 컨테이너가 없다. */
export const TEST_CONTAINERS = {
  postgresql: { package: '@testcontainers/postgresql', className: 'PostgreSqlContainer' },
  mysql: { package: '@testcontainers/mysql', className: 'MySqlContainer' },
  mongodb: { package: '@testcontainers/mongodb', className: 'MongoDBContainer' },
  sqlserver: { package: '@testcontainers/mssqlserver', className: 'MSSQLServerContainer' },
  sqlite: null,
  none: null,
};

const PRISMA_PROVIDERS = { postgresql: 'postgresql', postgres: 'postgresql', cockroachdb: 'postgresql', mysql: 'mysql', sqlite: 'sqlite', mongodb: 'mongodb', sqlserver: 'sqlserver' };

function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }

function prismaProvider(projectRoot) {
  for (const rel of ['prisma/schema.prisma', 'schema.prisma']) {
    const p = join(projectRoot, rel);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, 'utf8').match(/datasource\s+\w+\s*\{[^}]*provider\s*=\s*"(\w+)"/);
    if (m) return PRISMA_PROVIDERS[m[1]] ?? null;
  }
  return null;
}

/**
 * @param {string} projectRoot
 * @param {object} [config] `.dt-backend.json` 객체. 없으면 읽는다.
 * @returns {{ orm, db, cache, queue, auth, from: Record<string,string>, notes: string[], container, describe }}
 */
export function resolveBackendStack(projectRoot, config) {
  const cfg = config ?? readJson(join(projectRoot, '.dt-backend.json')) ?? {};
  const given = cfg.stack && typeof cfg.stack === 'object' ? cfg.stack : {};
  const pkg = readJson(join(projectRoot, 'package.json'));
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const out = { from: {}, notes: [] };
  for (const [area, def] of Object.entries(AREAS)) {
    if (given[area] != null) {
      if (!def.values.includes(given[area])) {
        throw new Error(`stack.${area} '${given[area]}' 는 모르는 값이다 — ${def.values.join(' | ')} 중 하나 (docs/refs/stack-config.md §4)`);
      }
      out[area] = given[area]; out.from[area] = '설정';
      continue;
    }
    if (area === 'db') {
      const prov = deps['@prisma/client'] || deps.prisma ? prismaProvider(projectRoot) : null;
      if (prov) { out.db = prov; out.from.db = 'schema.prisma provider'; continue; }
    }
    const found = [...new Set(def.detect.filter(([p]) => p in deps).map(([, v]) => v))];
    if (found.length === 1) { out[area] = found[0]; out.from[area] = 'package.json'; continue; }
    if (found.length > 1) {
      out[area] = found.includes(def.default) ? def.default : found[0];
      out.from[area] = 'package.json(여럿)';
      out.notes.push(`${area}: package.json 에 ${found.join('·')} 가 함께 있다 — ${out[area]} 로 봤다. 다르면 stack.${area} 로 적는다`);
      continue;
    }
    out[area] = def.default; out.from[area] = '기본값';
  }
  out.container = TEST_CONTAINERS[out.db] ?? null;
  out.describe = Object.keys(AREAS).map((a) => `${a} ${out[a]}(${out.from[a]})`).join(' · ');
  return out;
}

/** 빈칸 값 — `orm.<이름>` 만 있다. 모르는 이름이면 undefined. */
export function slotValue(stack, name) {
  const [area, key] = name.split('.');
  if (area !== 'orm') return undefined;
  return ORM_ADAPTERS[stack.orm]?.[key];
}

/** 규칙 머리말이 쓰는 빈칸 이름 전부(검사기용). */
export function slotNamesIn(value) {
  const s = JSON.stringify(value ?? null);
  return [...new Set([...s.matchAll(/"\$([a-z]+\.[a-zA-Z]+)"/g), ...s.matchAll(/\{\{([a-z]+\.[a-zA-Z]+)\}\}/g)].map((m) => m[1]))];
}
export const KNOWN_SLOTS = Object.keys(ORM_ADAPTERS.prisma).filter((k) => !['label', 'packages'].includes(k)).map((k) => `orm.${k}`);

const ARRAY_FIELDS = ['appliesTo', 'excludePathPatterns'];
const DET_ARRAY_FIELDS = ['matches', 'matchArguments', 'requireAll'];
const DET_REGEX_FIELDS = ['pattern', 'when', 'require', 'forbid'];

function expandArray(arr, stack) {
  if (!Array.isArray(arr)) return arr;
  return arr.flatMap((x) => {
    const m = typeof x === 'string' ? x.match(/^\$([a-z]+\.[a-zA-Z]+)$/) : null;
    if (!m) return [x];
    const v = slotValue(stack, m[1]);
    if (!Array.isArray(v)) throw new Error(`규칙 빈칸 "$${m[1]}" 은 배열 빈칸이 아니다`);
    return v;
  });
}
function expandRegex(str, stack) {
  if (typeof str !== 'string' || !str.includes('{{')) return str;
  let empty = false;
  const out = str.replace(/\{\{([a-z]+\.[a-zA-Z]+)\}\}/g, (_, name) => {
    const v = slotValue(stack, name);
    if (typeof v !== 'string') throw new Error(`규칙 빈칸 "{{${name}}}" 은 정규식 빈칸이 아니다`);
    if (!v) empty = true;
    return v;
  });
  return empty ? null : out;
}

/**
 * 규칙의 빈칸을 채운 새 목록과, 영역이 none 이라 건너뛴 규칙.
 * @returns {{ rules: object[], skipped: { ruleId: string, area: string }[] }}
 */
export function applyStackAdapters(rules, stack) {
  const kept = []; const skipped = [];
  for (const r of rules) {
    const need = (r.requiresStack ?? []).find((a) => stack[a] === 'none');
    if (need) { skipped.push({ ruleId: r.ruleId, area: need }); continue; }
    if (!slotNamesIn([r.appliesTo, r.excludePathPatterns, r.detection]).length) { kept.push(r); continue; }
    const next = { ...r };
    for (const f of ARRAY_FIELDS) next[f] = expandArray(r[f], stack);
    next.detection = r.detection.map((d) => {
      const o = { ...d };
      for (const f of DET_ARRAY_FIELDS) if (f in d) o[f] = expandArray(d[f], stack);
      for (const f of DET_REGEX_FIELDS) if (f in d) { const v = expandRegex(d[f], stack); if (v == null) delete o[f]; else o[f] = v; }
      return o;
    });
    kept.push(next);
  }
  return { rules: kept, skipped };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--project');
  const projectRoot = resolve(i >= 0 ? args[i + 1] : process.cwd());
  try {
    const r = resolveBackendStack(projectRoot);
    if (args.includes('--json')) {
      process.stdout.write(JSON.stringify({ orm: r.orm, db: r.db, cache: r.cache, queue: r.queue, auth: r.auth, container: r.container, from: r.from, notes: r.notes }, null, 2) + '\n');
    } else {
      for (const a of Object.keys(AREAS)) process.stdout.write(`  ${a.padEnd(6)} ${String(r[a]).padEnd(13)} [${r.from[a]}]\n`);
      process.stdout.write(`  컨테이너 ${r.container ? `${r.container.package} (${r.container.className})` : '없음'}\n`);
      for (const n of r.notes) process.stdout.write(`  ! ${n}\n`);
    }
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }
}
