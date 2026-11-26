#!/usr/bin/env node
/**
 * 스캐폴드 스택 프리셋(GEN-07) — 새 프로젝트를 만드는 명령·파일을 프리셋 하나와 패키지 관리자로 낸다.
 * 프리셋: templates/presets/<fe|be>/<이름>.json. 설치 버전은 templates/stack-versions.json 묶음 이름으로 고른다.
 * 키 설명은 docs/refs/stack-config.md §5.
 *
 * CLI
 *   node scripts/scaffoldPreset.mjs <frontend|backend> --list
 *   node scripts/scaffoldPreset.mjs <frontend|backend> [--preset <이름>] [--pm npm|pnpm|yarn] [--root <dir>] [--with auth,sentry]
 *        [--commands | --json | --file playwright|compose|env|schema|config]
 *   기본 출력은 --commands(셸 한 줄씩). 프리셋을 안 주면 그 스택의 기본 프리셋, --pm 을 안 주면 프리셋의 packageManager.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSIONS, installList, groupNames } from './stackVersions.mjs';
import { PACKAGE_MANAGERS } from './stackCommands.mjs';

const DIRS = { frontend: 'fe', backend: 'be' };
const SELF = fileURLToPath(import.meta.url);
const presetDir = (stack) => fileURLToPath(new URL(`../templates/presets/${DIRS[stack]}/`, import.meta.url));

/** 선택 묶음 — --with 로 더한다. */
export const EXTRAS = {
  frontend: { sentry: ['sentryDependencies', 'sentryDevDependencies'] },
  backend: { auth: ['authDependencies', 'authDevDependencies'] },
};

const PM = {
  npm: { add: ['npm', 'i'], addDev: ['npm', 'i', '-D'], install: ['npm', 'install'], exec: ['npx'], dlx: ['npx'], run: (s) => `npm run ${s}` },
  pnpm: { add: ['pnpm', 'add'], addDev: ['pnpm', 'add', '-D'], install: ['pnpm', 'install'], exec: ['pnpm', 'exec'], dlx: ['pnpm', 'dlx'], run: (s) => `pnpm ${s}` },
  yarn: { add: ['yarn', 'add'], addDev: ['yarn', 'add', '-D'], install: ['yarn', 'install'], exec: ['yarn'], dlx: ['yarn', 'dlx'], run: (s) => `yarn ${s}` },
};

function checkStack(stack) {
  if (!DIRS[stack]) throw new Error(`스택 '${stack}' 는 모른다 — frontend | backend`);
}

/** 그 스택의 프리셋 전부. */
export function listPresets(stack) {
  checkStack(stack);
  return readdirSync(presetDir(stack)).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(readFileSync(presetDir(stack) + f, 'utf8')));
}

/** 이름으로 프리셋. 이름이 없으면 기본 프리셋. */
export function loadPreset(stack, name) {
  const all = listPresets(stack);
  const p = name ? all.find((x) => x.name === name) : all.find((x) => x.default);
  if (!p) throw new Error(`${stack} 프리셋 '${name}' 은 없다 — ${all.map((x) => x.name).join(' | ')}`);
  return p;
}

/** 프리셋 하나의 모양 검사(테스트·검사기용). 문제 목록. */
export function presetProblems(p) {
  const out = [];
  const stack = p.stack;
  if (!DIRS[stack]) return [`${p.name}: stack 이 frontend|backend 가 아니다`];
  if (!PACKAGE_MANAGERS.includes(p.packageManager)) out.push(`${p.name}: packageManager '${p.packageManager}'`);
  for (const g of [...(p.groups?.dependencies ?? []), ...(p.groups?.devDependencies ?? [])]) {
    if (!groupNames(stack).includes(g)) out.push(`${p.name}: 모르는 설치 묶음 '${g}'`);
  }
  if (!p.groups?.dependencies?.includes('dependencies') || !p.groups?.devDependencies?.includes('devDependencies')) out.push(`${p.name}: 공통 묶음 dependencies·devDependencies 가 빠졌다`);
  if (!['create', 'nest'].includes(p.create?.kind)) out.push(`${p.name}: create.kind 는 create | nest`);
  if (p.allowBuilds != null && (!Array.isArray(p.allowBuilds) || p.allowBuilds.some((x) => typeof x !== 'string'))) out.push(`${p.name}: allowBuilds 는 패키지 이름 배열`);
  if (p.prisma && !['postgresql', 'mysql', 'sqlite', 'sqlserver', 'mongodb', 'cockroachdb'].includes(p.prisma.provider)) out.push(`${p.name}: prisma.provider '${p.prisma.provider}'`);
  if (stack === 'backend' && !p.db) out.push(`${p.name}: BE 프리셋은 db(compose·env)가 있어야 한다`);
  if (stack === 'frontend' && !p.dev?.port) out.push(`${p.name}: FE 프리셋은 dev.port 가 있어야 한다`);
  return out;
}

const join = (arr) => arr.join(' ');

/**
 * 프리셋 → 실행 계획.
 * @returns {{ preset, packageManager, steps: {id: string, command: string}[], files: Record<string,string>, config: object, devUrl: string|null, setup: string[] }}
 */
export function planScaffold({ stack, preset: presetName, pm, root = '<project-root>', with: extras = [] } = {}) {
  checkStack(stack);
  const preset = loadPreset(stack, presetName);
  const pmName = pm ?? preset.packageManager;
  if (!PACKAGE_MANAGERS.includes(pmName)) throw new Error(`패키지 관리자 '${pmName}' 는 모른다 — ${PACKAGE_MANAGERS.join(' | ')}`);
  for (const x of extras) if (!EXTRAS[stack][x]) throw new Error(`--with '${x}' 는 ${stack} 에 없다 — ${Object.keys(EXTRAS[stack]).join(' | ') || '없음'}`);
  const P = PM[pmName];
  const create = VERSIONS[stack].create;
  const steps = [];

  if (preset.create.kind === 'create') {
    // create-vite@7 → `<pm> create vite@7 <root> …`. npm 만 도구 인자 앞에 `--` 가 필요하다.
    const tool = create.replace(/^create-/, '');
    const args = preset.create.args ?? [];
    steps.push({ id: 'create', command: join([pmName, 'create', tool, root, ...(pmName === 'npm' && args.length ? ['--'] : []), ...args]) });
  } else {
    steps.push({ id: 'create', command: join([...P.dlx, create, 'new', root, '--skip-git', '--package-manager', pmName]) });
  }
  steps.push({ id: 'cd', command: `cd ${root}` });

  const pkgs = (groups) => groups.flatMap((g) => installList(stack, g));
  // pnpm 10+ 는 설치 스크립트가 있는 패키지(esbuild·msw·prisma 등)를 허용 목록 없이 만나면 add 를 실패로 끝낸다.
  // 프리셋의 allowBuilds 를 --allow-build 로 넘기면 pnpm 이 pnpm-workspace.yaml 의 allowBuilds 에 적는다.
  const allow = pmName === 'pnpm' ? (preset.allowBuilds ?? []).map((p) => `--allow-build=${p}`) : [];
  steps.push({ id: 'deps', command: join([...P.add, ...pkgs(preset.groups.dependencies), ...allow]) });
  steps.push({ id: 'devDeps', command: join([...P.addDev, ...pkgs(preset.groups.devDependencies), ...allow]) });
  for (const cmd of preset.init ?? []) steps.push({ id: 'init', command: join([...P.exec, ...cmd]) });
  // Prisma 스키마는 `prisma init` 대신 파일로 낸다 — 6.19+ 의 init 은 Prisma 7 모양(generator `prisma-client` +
  // output `../generated/prisma` + dotenv 를 읽는 prisma.config.ts)을 써서 `import { PrismaClient } from '@prisma/client'` 가 깨진다.
  if (preset.prisma) {
    steps.push({ id: 'prismaSchema', command: 'mkdir -p prisma' });
    steps.push({ id: 'prismaSchema', command: `node "${SELF}" backend --preset ${preset.name} --file schema > prisma/schema.prisma` });
  }
  for (const x of extras) {
    const [dep, dev] = EXTRAS[stack][x];
    steps.push({ id: `${x}Deps`, command: join([...P.add, ...installList(stack, dep), ...allow]) });
    steps.push({ id: `${x}DevDeps`, command: join([...P.addDev, ...installList(stack, dev), ...allow]) });
  }
  // BE 는 nest new 가 이미 설치한다. FE 는 생성 도구가 설치하지 않으므로 한 번 깔고 e2e 브라우저를 받는다.
  if (stack === 'frontend') {
    steps.push({ id: 'install', command: join(P.install) });
    steps.push({ id: 'browsers', command: join([...P.exec, 'playwright', 'install', 'chromium']) });
  }

  const config = { preset: preset.name, packageManager: pmName, ...structuredClone(preset.config ?? {}) };
  const files = { config: JSON.stringify(config, null, 2) + '\n' };
  let devUrl = null;
  if (stack === 'frontend') {
    devUrl = `http://localhost:${preset.dev.port}`;
    files.playwright = playwrightConfig(devUrl, P.run('dev'));
  }
  if (preset.db) {
    files.compose = composeFile(preset.db);
    files.env = envFile(preset.db);
  }
  if (preset.prisma) files.schema = prismaSchema(preset.prisma.provider);
  return { preset: preset.name, label: preset.label, packageManager: pmName, steps, files, config, devUrl, setup: preset.setup ?? [] };
}

export function playwrightConfig(url, devCommand) {
  return `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: { baseURL: '${url}' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // 기본은 MSW 격리. 실연동은 E2E_LIVE=1로 VITE_USE_MOCKS를 끈다.
    command: process.env.E2E_LIVE ? 'VITE_USE_MOCKS=false ${devCommand}' : 'VITE_USE_MOCKS=true ${devCommand}',
    url: '${url}',
    reuseExistingServer: false, // 실연동 dev 서버 재사용 방지
  },
});
`;
}

/** dev·마이그레이션 전용 compose. 값은 .env 에서 읽는다(compose 가 같은 폴더의 .env 를 읽는다). */
export function composeFile(db) {
  const env = db.containerEnv.map((k) => `      ${k}: \${${k}}`).join('\n');
  return `services:
  db:
    image: ${db.image}
    environment:
${env}
    ports:
      - "\${${db.portVar}}:${db.containerPort}"
    healthcheck:
      test: ["CMD-SHELL", "${db.healthcheck}"]
      interval: 5s
      timeout: 5s
      retries: 10
    volumes:
      - db-data:${db.volumePath}

volumes:
  db-data:
`;
}

/** 캐논 Prisma 6 스키마 — 클라이언트는 node_modules/@prisma/client 로 생성된다(output 없음). */
export function prismaSchema(provider) {
  return `// Prisma 6 — 클라이언트는 \`import { PrismaClient } from '@prisma/client'\` 로 가져온다(output 을 두지 않는다).
// 모델은 모듈 스캐폴드(new-module Phase 1)의 schema.delta.prisma 를 여기에 합친다.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}
`;
}

/** compose 와 같은 값의 .env. DATABASE_URL 은 값을 채워 적는다(도구마다 변수 펼치기가 달라서). */
export function envFile(db) {
  const url = db.url.replace(/\$\{(\w+)\}/g, (_, k) => db.env[k] ?? '');
  return [...Object.entries(db.env).map(([k, v]) => `${k}=${v}`), `DATABASE_URL="${url}"`].join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const stack = args[0];
  const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  try {
    if (args.includes('--list')) {
      for (const p of listPresets(stack)) process.stdout.write(`${p.default ? '*' : ' '} ${p.name.padEnd(22)} ${p.label}\n`);
      process.exit(0);
    }
    const plan = planScaffold({ stack, preset: opt('preset'), pm: opt('pm'), root: opt('root'), with: (opt('with') ?? '').split(',').filter(Boolean) });
    const file = opt('file');
    if (file) {
      if (!(file in plan.files)) throw new Error(`--file '${file}' 는 이 프리셋에 없다 — ${Object.keys(plan.files).join(' | ')}`);
      process.stdout.write(plan.files[file]);
    } else if (args.includes('--json')) {
      process.stdout.write(JSON.stringify(plan, null, 2) + '\n');
    } else {
      process.stdout.write(`# ${plan.preset} — ${plan.label} (${plan.packageManager})\n`);
      for (const s of plan.steps) process.stdout.write(`${s.command}\n`);
    }
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(2);
  }
}
