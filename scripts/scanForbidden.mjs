#!/usr/bin/env node
// 금칙어 스캐너 — 공개 저장소에 올라가면 안 되는 문자열(개인 이메일·실제 cloudId·조직별 식별자)을 찾는다.
//
// 엔진만 플러그인에 둔다. 조직별 금칙어 목록(회사명·고객사명·티켓 키 …)은 목록 자체가 식별자라
// 저장소에 넣지 않고, 저장소 밖 JSON 으로 받는다: `--rules <file>` 또는 환경변수 DT_FORBIDDEN_RULES.
//
// 규칙 파일 형식:
//   { "rules": [{ "name": "사내 도메인", "pattern": "acme-corp", "flags": "gi" }],
//     "allow": [{ "pattern": "^noreply@acme-corp\\.com$", "flags": "i" }] }
//
// 사용: node scripts/scanForbidden.mjs [root] [--rules <file>]   (찾으면 exit 1)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 어느 프로젝트에서나 공개되면 안 되는 것 — 조직 목록 없이도 돈다. */
export const BUILTIN_RULES = [
  // TLD 마지막 라벨을 문자로 한정 — `pnpm@10.0.0` 같은 버전 표기를 이메일로 오탐하지 않는다.
  { name: '이메일', re: /\b[\w.+-]+@[a-zA-Z0-9][a-zA-Z0-9-]*(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}\b/g },
  { name: 'cloudId 형태 UUID', re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g },
];

/** 남아도 되는 자리표 — 예시 도메인·커밋 서명·0 UUID·한 글자 픽스처 메일. */
export const BUILTIN_ALLOW = [
  /(?:@|\.)example\.(?:com|org|net)$/i,
  /(?:@|\.)test\.com$/i,
  /\.test$/i,
  /^noreply@anthropic\.com$/i,
  /^00000000-0000-0000-0000-000000000000$/,
  /^a@[a-z]\.com$/i,
];

// 텍스트로 읽으면 오탐만 내는 순수 바이너리. PDF·zip 은 안에 텍스트를 담으므로 일부러 뺀다.
const BINARY_EXT = new Set(['.woff', '.woff2', '.ttf', '.otf', '.eot', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp']);
const MAX_BYTES = 2_000_000;
const SKIP_DIRS = new Set(['.git', 'node_modules']);

/** 규칙 파일(JSON)을 읽어 { rules, allow } 를 돌려준다. 파일이 없으면 빈 목록. */
export function loadRuleFile(file) {
  if (!file) return { rules: [], allow: [] };
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const toRe = (r, defaultFlags) => new RegExp(r.pattern, r.flags ?? defaultFlags);
  return {
    rules: (raw.rules ?? []).map((r) => ({ name: r.name, re: toRe(r, 'g') })).map((r) => ({ ...r, re: r.re.global ? r.re : new RegExp(r.re.source, `${r.re.flags}g`) })),
    allow: (raw.allow ?? []).map((a) => toRe(a, '')),
  };
}

/** 한 텍스트에서 규칙 위반을 찾는다. 반환: [{ line, rule, match }] */
export function scanText(text, rules = BUILTIN_RULES, allow = BUILTIN_ALLOW) {
  const out = [];
  for (const rule of rules) {
    rule.re.lastIndex = 0;
    for (const m of text.matchAll(rule.re)) {
      if (allow.some((a) => a.test(m[0]))) continue;
      out.push({ line: text.slice(0, m.index).split('\n').length, rule: rule.name, match: m[0] });
    }
  }
  return out;
}

/** 검사 대상 파일. git 저장소면 "올라갈 수 있는 파일"(추적 + 무시되지 않은 새 파일)만, 아니면 전부. */
export function listFiles(root) {
  try {
    const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\0').filter(Boolean).map((f) => join(root, f));
  } catch {
    const files = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name)); }
        else if (e.isFile()) files.push(join(dir, e.name));
      }
    };
    walk(root);
    return files;
  }
}

/** 저장소 전체를 검사한다. 반환: [{ file, line, rule, match }] (file 은 root 기준 상대 경로) */
export function scanRepo(root, { ruleFile } = {}) {
  const extra = loadRuleFile(ruleFile);
  const rules = [...BUILTIN_RULES, ...extra.rules];
  const allow = [...BUILTIN_ALLOW, ...extra.allow];
  const findings = [];
  for (const file of listFiles(root)) {
    if (BINARY_EXT.has(extname(file).toLowerCase())) continue;
    let st;
    try { st = statSync(file); } catch { continue; }   // 지워졌지만 아직 index 에 있는 파일
    if (!st.isFile() || st.size > MAX_BYTES) continue;
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    for (const f of scanText(text, rules, allow)) findings.push({ file: relative(root, file), ...f });
  }
  return findings;
}

function main(argv) {
  const args = argv.slice(2);
  const i = args.indexOf('--rules');
  const ruleFile = i >= 0 ? args[i + 1] : process.env.DT_FORBIDDEN_RULES || undefined;
  const root = resolve(args.find((a, j) => !a.startsWith('--') && args[j - 1] !== '--rules') ?? '.');
  const findings = scanRepo(root, { ruleFile });
  for (const f of findings) console.log(`${f.file}:${f.line} [${f.rule}] ${f.match}`);
  const scope = ruleFile ? `내장 규칙 + ${ruleFile}` : '내장 규칙만 (조직 목록: --rules 또는 DT_FORBIDDEN_RULES)';
  if (findings.length) {
    console.error(`금칙어 ${findings.length}건 — 올리지 않는다. 검사 범위: ${scope}`);
    process.exit(1);
  }
  console.log(`금칙어 0건. 검사 범위: ${scope}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv);
