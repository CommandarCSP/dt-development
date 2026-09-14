#!/usr/bin/env node
// materialize-tokens.mjs — project-context.md ## 디자인 토큰 → globals.css @theme
//
// Figma에서 뽑아 project-context.md에 누적된 디자인 토큰(색/타이포/간격/radius)을
// 프로젝트의 런타임 테마(src/styles/globals.css의 Tailwind v4 `@theme`)로 물질화한다.
// 매핑 규약: skills/dt-frontend-architecture/references/token-css-var-bridge.md.
//
// 머지 안전: 생성 블록은 마커(/* dt:tokens:start */ … /* dt:tokens:end */) 안에만 쓴다.
// 마커 밖 사용자 편집은 절대 건드리지 않는다(diff-then-confirm 원칙). 마커가 없으면
// @import "tailwindcss" 직후(없으면 파일 선두)에 삽입한다.
//
// 사용:
//   node materialize-tokens.mjs [--project <root>] [--context <path>] [--out <globals.css>] [--dry-run]
// 기본: project=cwd, context=<project>/docs/project-context.md, out=<project>/src/styles/globals.css

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

// 감지는 안정적인 태그 접두사로 한다(설명 문구가 바뀌어도 재감지 가능 — 중복 삽입 방지).
const START_TAG = '/* dt:tokens:start';
const END_TAG = '/* dt:tokens:end */';
const START = `${START_TAG} — generated from docs/project-context.md ## 디자인 토큰. 이 블록은 materialize-tokens.mjs가 재생성한다. 밖에서 수동 편집하세요. */`;
const END = END_TAG;

const WEIGHT_KEYWORDS = new Set([
  'thin', 'extralight', 'ultralight', 'light', 'regular', 'normal', 'book',
  'medium', 'semibold', 'demibold', 'bold', 'extrabold', 'ultrabold', 'black', 'heavy',
]);
const WEIGHT_MAP = {
  thin: 100, extralight: 200, ultralight: 200, light: 300, regular: 400, normal: 400,
  book: 400, medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800,
  ultrabold: 800, black: 900, heavy: 900,
};

function slug(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'x';
}

// --- Parser: ## 디자인 토큰 섹션에서 서브섹션(### 색/타이포그래피/간격/radius)을 추출 ---
export function parseDesignTokens(contextMd) {
  const out = { colors: [], typography: [], spacing: [], radius: [] };
  if (!contextMd) return out;

  // ## 디자인 토큰 … (다음 ## 전 또는 입력 끝까지) 잘라내기.
  // (?![\s\S]) = 입력의 진짜 끝. JS 정규식엔 \Z가 없다.
  const secMatch = contextMd.match(/^##\s+디자인\s*토큰\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/m);
  if (!secMatch) return out;
  const body = secMatch[1];

  const subFor = (title) => {
    const re = new RegExp(`^###\\s+${title}\\s*$([\\s\\S]*?)(?=^###\\s|(?![\\s\\S]))`, 'm');
    const m = body.match(re);
    return m ? m[1] : '';
  };
  const bullets = (block) =>
    block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('- '))
      .map((l) => l.slice(2).trim())
      .filter(Boolean);

  // 색: "name: #hex" 또는 "name: value"
  for (const b of bullets(subFor('색'))) {
    const idx = b.indexOf(':');
    if (idx === -1) continue;
    const name = b.slice(0, idx).trim();
    const value = b.slice(idx + 1).trim();
    if (name && value) out.colors.push({ name, value });
  }

  // 타이포그래피: "Name: Family Weight Size"
  for (const b of bullets(subFor('타이포그래피'))) {
    const idx = b.indexOf(':');
    if (idx === -1) continue;
    const name = b.slice(0, idx).trim();
    const rest = b.slice(idx + 1).trim();
    const sizeM = rest.match(/(\d+(?:\.\d+)?)\s*px/i);
    const size = sizeM ? Number(sizeM[1]) : null;
    // family = size/weight 키워드가 아닌 앞쪽 토큰들
    const words = rest.replace(/(\d+(?:\.\d+)?)\s*px/i, '').trim().split(/\s+/).filter(Boolean);
    const familyWords = [];
    let weight = null;
    for (const w of words) {
      const lw = w.toLowerCase();
      if (WEIGHT_KEYWORDS.has(lw)) { weight = WEIGHT_MAP[lw]; continue; }
      if (/^\d{3}$/.test(w)) { weight = Number(w); continue; }
      familyWords.push(w);
    }
    out.typography.push({ name, family: familyWords.join(' ') || null, weight, size });
  }

  // 간격: "4, 8, 12, 16, 24"
  for (const b of bullets(subFor('간격'))) {
    for (const n of b.split(',').map((s) => s.trim()).filter(Boolean)) {
      const v = Number(n.replace(/px$/i, ''));
      if (Number.isFinite(v)) out.spacing.push(v);
    }
  }

  // radius: "4, 8"
  for (const b of bullets(subFor('radius'))) {
    for (const n of b.split(',').map((s) => s.trim()).filter(Boolean)) {
      const v = Number(n.replace(/px$/i, ''));
      if (Number.isFinite(v)) out.radius.push(v);
    }
  }

  return out;
}

// --- Generator: 토큰 → @theme 블록 ---
export function renderThemeBlock(tokens) {
  const lines = ['@theme {'];

  if (tokens.colors.length) {
    lines.push('  /* 색 — semantic 우선(bg-background, text-foreground …) */');
    for (const { name, value } of tokens.colors) {
      lines.push(`  --color-${slug(name)}: ${value};`);
    }
  }

  if (tokens.typography.length) {
    lines.push('  /* 타이포그래피 */');
    // 대표 폰트 패밀리(가장 흔한 것)를 --font-sans로
    const famCount = new Map();
    for (const t of tokens.typography) {
      if (t.family) famCount.set(t.family, (famCount.get(t.family) || 0) + 1);
    }
    if (famCount.size) {
      const topFamily = [...famCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
      lines.push(`  --font-sans: "${topFamily}", ui-sans-serif, system-ui, sans-serif;`);
    }
    for (const t of tokens.typography) {
      if (t.size != null) lines.push(`  --text-${slug(t.name)}: ${t.size}px;`);
      if (t.weight != null) lines.push(`  --font-weight-${slug(t.name)}: ${t.weight};`);
    }
  }

  if (tokens.spacing.length) {
    lines.push('  /* 간격 (p-*, gap-* 등) */');
    for (const v of [...new Set(tokens.spacing)].sort((a, b) => a - b)) {
      lines.push(`  --spacing-${slug(String(v))}: ${v}px;`);
    }
  }

  if (tokens.radius.length) {
    lines.push('  /* radius (rounded-*) */');
    for (const v of [...new Set(tokens.radius)].sort((a, b) => a - b)) {
      lines.push(`  --radius-${slug(String(v))}: ${v}px;`);
    }
  }

  lines.push('}');
  return `${START}\n${lines.join('\n')}\n${END}`;
}

// --- Merge: 마커 블록 안만 교체, 밖은 보존 ---
export function mergeIntoGlobals(existing, themeBlock) {
  if (existing == null || existing === '') {
    return `@import "tailwindcss";\n\n${themeBlock}\n`;
  }
  const startIdx = existing.indexOf(START_TAG);
  const endIdx = existing.indexOf(END_TAG);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // 기존 마커 블록 교체 (시작 주석 문구가 달라도 태그로 감지)
    return existing.slice(0, startIdx) + themeBlock + existing.slice(endIdx + END_TAG.length);
  }
  // 마커 없음 → @import "tailwindcss" 직후 삽입, 없으면 선두
  const importM = existing.match(/^@import\s+["']tailwindcss["'];?\s*$/m);
  if (importM) {
    const insertAt = importM.index + importM[0].length;
    return existing.slice(0, insertAt) + `\n\n${themeBlock}\n` + existing.slice(insertAt);
  }
  return `${themeBlock}\n\n${existing}`;
}

export function materialize({ contextPath, outPath, dryRun = false }) {
  const contextMd = existsSync(contextPath) ? readFileSync(contextPath, 'utf8') : '';
  const tokens = parseDesignTokens(contextMd);
  const total =
    tokens.colors.length + tokens.typography.length + tokens.spacing.length + tokens.radius.length;
  const themeBlock = renderThemeBlock(tokens);
  const existing = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
  const next = mergeIntoGlobals(existing, themeBlock);
  const changed = next !== existing;
  if (!dryRun && changed) {
    if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, next, 'utf8');
  }
  return { tokens, total, changed, themeBlock, output: next };
}

// --- CLI ---
function parseArgs(argv) {
  const a = { project: process.cwd(), context: null, out: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--project') a.project = resolve(argv[++i]);
    else if (k === '--context') a.context = resolve(argv[++i]);
    else if (k === '--out') a.out = resolve(argv[++i]);
    else if (k === '--dry-run') a.dryRun = true;
  }
  a.context ||= join(a.project, 'docs', 'project-context.md');
  a.out ||= join(a.project, 'src', 'styles', 'globals.css');
  return a;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.context)) {
    console.error(`[materialize-tokens] project-context 없음: ${args.context} — 빈 @theme 유지, skip.`);
    process.exit(0);
  }
  const r = materialize({ contextPath: args.context, outPath: args.out, dryRun: args.dryRun });
  const n = r.tokens;
  console.error(
    `[materialize-tokens] 색 ${n.colors.length} · 타이포 ${n.typography.length} · 간격 ${n.spacing.length} · radius ${n.radius.length} (총 ${r.total})`,
  );
  if (r.total === 0) {
    console.error('[materialize-tokens] 토큰 0개 — @theme 비움. (페이지 분석 누적 전이거나 Figma 미소스)');
  }
  console.error(`[materialize-tokens] ${args.dryRun ? '(dry-run) ' : ''}${r.changed ? '갱신됨' : '변경 없음'}: ${args.out}`);
  if (args.dryRun) process.stdout.write(r.themeBlock + '\n');
}
