#!/usr/bin/env node
/**
 * 스펙·계획 산출물 형식 검사기 — 정의서(`validateDefinition.mjs`) 밖의 산출물을 본다.
 * 형식만 본다. 내용이 맞는지는 reviewer·auditor 몫이다.
 *
 * 종류(kind): requirements | design | tasks | layout-skeleton | api-contract | plan | interactions | e2e-ledger
 * 결과: `{ kind, stack, errors: [{ line, rule, message }], warnings: [...], strict }`
 *   - errors 가 있으면 그 산출물은 `status: finalized` 가 될 수 없다(작성 에이전트가 고치거나 draft 로 둔다).
 *   - 스펙 4종·api-contract 는 머리 주석 `specVersion` 이 1.1 이상일 때만 오류를 오류로 둔다. 머리 주석이 없거나
 *     옛 버전이면 같은 검사를 경고로 낮춘다(`strict: false`) — 이미 쓰던 스펙이 재실행 한 번에 draft 로 떨어지지 않게.
 *   - plan·interactions·e2e 원장은 늘 엄격하다(이 형식이 생긴 뒤에만 만들어진 산출물이다).
 *
 * CLI: node scripts/validateSpec.mjs <file…> [--kind <kind>] [--json]   — 오류가 하나라도 있으면 exit 1
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSpecHeader } from './buildSpecHeader.mjs';
import { parseSections } from './lib/sections.mjs';
import { detectLegacy as interactionsLegacy, OWNERS as INTERACTION_OWNERS } from './interactionsSync.mjs';

export const SOURCE_LABELS = ['ai-confirmed', 'ai-edited', 'user-added', 'inferred', 'user-resolved', 'precedence-resolved'];
export const PATTERN_LABELS = ['Ubiquitous', 'Event-driven', 'State-driven', 'Optional', 'Complex', 'Unwanted'];
const PATTERN_KEYWORD = { 'Event-driven': /\bWHEN\b/, 'State-driven': /\bWHILE\b/, Optional: /\bWHERE\b/, Unwanted: /\bIF\b[\s\S]*\bTHEN\b/, Complex: /\bWHEN\b[\s\S]*\bWHILE\b|\bWHILE\b[\s\S]*\bWHEN\b/ };
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const LEDGER_STATUSES = ['proposed', 'approved', 'automated', 'verified', 'failed', 'stale'];
const ENDPOINT_COLUMNS = ['Method', 'Path', 'Auth', 'Request DTO', 'Response DTO', 'Status'];

const REQUIRED_SECTIONS = {
  'requirements:frontend': ['사용자 스토리', '기능 요구사항', '라우팅 / 네비게이션', '비기능 요구사항', '접근 권한'],
  'requirements:backend': ['사용자 스토리 / 시나리오', '기능 요구사항', '비기능 요구사항', '접근 권한 / 인증·인가', '데이터 명세'],
  'design:frontend': ['아키텍처', '데이터 모델 / API 계약', '컴포넌트 구조', '시퀀스', '요구사항 매핑'],
  'design:backend': ['아키텍처', '데이터 모델 / API 계약', '인덱스 & 페이지네이션 전략', '시퀀스', '요구사항 매핑'],
  'layout-skeleton:frontend': ['코딩 에이전트 변환 지침', '스켈레톤'],
  'api-contract:backend': ['스캐폴드 변환 지침', '엔드포인트', '요청/응답 스키마'],
};

/** 파일 경로로 종류·스택을 가린다. 모르면 null. */
export function detectKind(path) {
  const p = path.replace(/\\/g, '/');
  const name = basename(p);
  const stack = /\/resources\//.test(p) ? 'backend' : /\/pages\//.test(p) ? 'frontend' : null;
  if (/\.e2e-scenarios\.md$/.test(name) || /\/e2e\/(be-)?journeys\.md$/.test(p)) return { kind: 'e2e-ledger', stack: /be-journeys|\/resources\//.test(p) ? 'backend' : 'frontend' };
  if (name === 'interactions.md') return { kind: 'interactions', stack: null };
  const base = name.replace(/\.md$/, '');
  if (['requirements', 'design', 'tasks', 'layout-skeleton', 'api-contract', 'plan'].includes(base)) {
    return { kind: base, stack: base === 'api-contract' ? 'backend' : base === 'layout-skeleton' ? 'frontend' : stack };
  }
  return null;
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** `### FR-N: 요약  \`[출처] [패턴]\`` 목록. 형식이 틀린 FR 제목은 bad 로. */
export function parseFRs(text) {
  const frs = [];
  const bad = [];
  const re = /^### (FR-[^\s:]*)(.*)$/gm;
  let m;
  const heads = [];
  while ((m = re.exec(text))) heads.push({ index: m.index, id: m[1], rest: m[2] });
  heads.forEach((h, i) => {
    const headEnd = text.indexOf('\n', h.index) < 0 ? text.length : text.indexOf('\n', h.index) + 1;
    const nextHead = (() => { const n = text.slice(headEnd).search(/^#{1,3} /m); return n < 0 ? text.length : headEnd + n; })();
    const end = i + 1 < heads.length ? Math.min(heads[i + 1].index, nextHead) : nextHead;
    const body = text.slice(h.index, end).split('\n').slice(1).join('\n');
    const line = lineOf(text, h.index);
    const ok = /^FR-\d+$/.test(h.id) && /^\s*:\s*\S.*`\s*\[[^\]]+\]\s*\[[^\]]+\]\s*`/.test(h.rest);
    if (!ok) { bad.push({ line, head: `### ${h.id}${h.rest}` }); return; }
    const labels = [...h.rest.match(/`([^`]*)`/)[1].matchAll(/\[([^\]]+)\]/g)].map((x) => x[1].replace(/\(.*\)$/, '').trim());
    frs.push({ id: h.id, line, labels, body });
  });
  return { frs, bad };
}

const frRefs = (text) => [...new Set([...text.matchAll(/\bFR-(\d+)\b/g)].map((m) => `FR-${m[1]}`))];

export function validateSpec(text, { kind, stack = null, siblings = {} } = {}) {
  const errors = [];
  const warnings = [];
  const err = (line, rule, message) => errors.push({ line, rule, message });
  const warn = (line, rule, message) => warnings.push({ line, rule, message });

  const isSpec = ['requirements', 'design', 'tasks', 'layout-skeleton', 'api-contract'].includes(kind);
  const header = isSpec ? parseSpecHeader(text) : null;
  const strict = !isSpec || (header && Number(header.specVersion) >= 1.1);
  if (isSpec && !header) warn(1, 'header', '머리 주석(Generated by·status·sources·specVersion)이 없다 — 손으로 쓴 스펙으로 보고 경고만 낸다');

  // 공통: 채우지 않은 템플릿 자리표
  for (const m of text.matchAll(/\{\{[A-Z_]+[^}]*\}\}/g)) err(lineOf(text, m.index), 'placeholder', `채우지 않은 템플릿 자리표 ${m[0]}`);

  const keys = parseSections(text).sections.map((s) => s.key);
  const req = REQUIRED_SECTIONS[`${kind}:${stack}`];
  if (!req && (REQUIRED_SECTIONS[`${kind}:frontend`] || REQUIRED_SECTIONS[`${kind}:backend`])) warn(1, 'stack-unknown', '경로로 FE·BE 를 가리지 못해 필수 절 검사를 건너뛴다(docs/specs/pages|resources/ 아래에 둔다)');
  for (const s of req ?? []) if (!keys.includes(s)) err(1, 'required-section', `필수 절 "## ${s}" 가 없다`);

  if (kind === 'requirements') {
    const { frs, bad } = parseFRs(text);
    for (const b of bad) err(b.line, 'fr-heading', `FR 제목 형식이 틀렸다: "${b.head.slice(0, 60)}" — "### FR-N: 요약  \`[출처] [패턴]\`"`);
    const seen = new Map();
    for (const fr of frs) {
      if (seen.has(fr.id)) err(fr.line, 'fr-duplicate', `${fr.id} 가 ${seen.get(fr.id)}행에도 있다`);
      seen.set(fr.id, fr.line);
      const src = fr.labels.filter((l) => SOURCE_LABELS.includes(l));
      const pat = fr.labels.filter((l) => PATTERN_LABELS.includes(l));
      const unknown = fr.labels.filter((l) => !SOURCE_LABELS.includes(l) && !PATTERN_LABELS.includes(l) && l !== '제안');
      if (!src.length) err(fr.line, 'fr-source-label', `${fr.id}: 출처 라벨(${SOURCE_LABELS.join('·')})이 없다`);
      if (pat.length !== 1) err(fr.line, 'fr-pattern-label', `${fr.id}: EARS 패턴 라벨이 하나여야 한다(${PATTERN_LABELS.join('·')})`);
      for (const u of unknown) warn(fr.line, 'fr-unknown-label', `${fr.id}: 모르는 라벨 [${u}]`);
      const p = pat[0];
      if (p && PATTERN_KEYWORD[p] && !PATTERN_KEYWORD[p].test(fr.body)) err(fr.line, 'ears-keyword', `${fr.id}: [${p}] 인데 본문에 EARS 키워드가 없다`);
      if (p && p !== 'Unwanted' && !/\bSHALL\b/.test(fr.body)) warn(fr.line, 'ears-shall', `${fr.id}: 본문에 SHALL 이 없다`);
    }
    if (!frs.length && !bad.length) warn(1, 'fr-none', 'FR 이 하나도 없다');
  }

  if (kind === 'design' || kind === 'tasks') {
    const known = siblings.requirements ? new Set(parseFRs(siblings.requirements).frs.map((f) => f.id)) : null;
    if (known) for (const id of frRefs(text)) if (!known.has(id)) err(1, 'fr-ref', `${id} 를 참조하지만 requirements.md 에 없다`);
  }

  if (kind === 'tasks' || kind === 'plan') {
    text.split('\n').forEach((l, i) => {
      if (/^\s*[-*] \[/.test(l) && !/^\s*[-*] \[( |x|X)\] \S/.test(l)) err(i + 1, 'checkbox', `체크박스 문법이 틀렸다: "${l.trim().slice(0, 50)}" — "- [ ] 내용" / "- [x] 내용"`);
    });
  }

  if (kind === 'plan') {
    if (!/^## Phase \d+/m.test(text)) err(1, 'plan-phase', '"## Phase N — …" 절이 없다');
    if (!/^\s*[-*] \[( |x|X)\] /m.test(text)) err(1, 'plan-checkbox', '체크박스가 하나도 없다');
    text.split('\n').forEach((l, i) => {
      if (!/^\s*[-*] \[/.test(l)) return;
      if (/(^|[^.])\.\.\.(?!\.)|…|\bTODO\b/.test(l.replace(/`\.\.\.`/g, ''))) err(i + 1, 'plan-placeholder', `플랜에 자리표(…·TODO)가 남았다 — 코드·경로를 구체로 적는다: "${l.trim().slice(0, 50)}"`);
    });
  }

  if (kind === 'api-contract') {
    const sec = parseSections(text).sections.find((s) => s.key === '엔드포인트');
    const tableLines = sec ? sec.text.split('\n').filter((l) => /^\|/.test(l)) : [];
    if (sec && !tableLines.length) err(1, 'endpoint-table', '"## 엔드포인트" 에 표가 없다');
    if (tableLines.length) {
      const cols = tableLines[0].split('|').slice(1, -1).map((c) => c.trim());
      const missing = ENDPOINT_COLUMNS.filter((c) => !cols.includes(c));
      if (missing.length) err(1, 'endpoint-columns', `엔드포인트 표에 열이 없다: ${missing.join(', ')}`);
      const idx = (c) => cols.indexOf(c);
      for (const row of tableLines.slice(2)) {
        const cells = row.split('|').slice(1, -1).map((c) => c.trim().replace(/`/g, ''));
        const line = lineOf(text, text.indexOf(row));
        const method = cells[idx('Method')];
        const path = cells[idx('Path')];
        const status = cells[idx('Status')] ?? '';
        if (method !== undefined && !HTTP_METHODS.includes(method)) err(line, 'endpoint-method', `Method "${method}" 는 ${HTTP_METHODS.join('·')} 가 아니다`);
        if (path !== undefined && !path.startsWith('/')) err(line, 'endpoint-path', `Path "${path}" 는 / 로 시작해야 한다`);
        const codes = [...status.matchAll(/\b\d+\b/g)].map((x) => Number(x[0]));
        if (!codes.length) err(line, 'endpoint-status', `Status 에 상태 코드가 없다: "${status}"`);
        for (const c of codes) if (c < 100 || c > 599) err(line, 'endpoint-status', `Status ${c} 는 HTTP 상태 코드가 아니다`);
      }
    }
  }

  if (kind === 'interactions') {
    if (interactionsLegacy(text)) err(1, 'interactions-sections', `소유 절(## ${INTERACTION_OWNERS.frontend}·## ${INTERACTION_OWNERS.backend}) 밖에 ## 절이 있다 — scripts/interactionsSync.mjs migrate 로 옮긴다`);
    for (const s of parseSections(text).sections) if (!/^### /m.test(s.text)) warn(1, 'interactions-subsections', `"## ${s.key}" 에 ### 하위 항목이 없다`);
  }

  if (kind === 'e2e-ledger') {
    const journeys = /journeys/.test(siblings.path ?? '');
    if (!/<!-- basedOnSpec: .+ -->/.test(text)) (journeys ? warn : err)(1, 'ledger-marker', '원장 상단에 <!-- basedOnSpec: … --> 마커가 없다(stale 판정 기준)');
    const statusRe = /\bstatus\b\s*[:：]\s*`?([a-z]+)`?/gi;
    for (const m of text.matchAll(statusRe)) if (!LEDGER_STATUSES.includes(m[1].toLowerCase())) err(lineOf(text, m.index), 'ledger-status', `상태 "${m[1]}" 는 ${LEDGER_STATUSES.join('·')} 가 아니다`);
    for (const t of text.split(/\n(?!\|)/).filter((b) => /^\|/.test(b))) {
      const rows = t.split('\n').filter((l) => /^\|/.test(l));
      const cols = rows[0].split('|').slice(1, -1).map((c) => c.trim().toLowerCase());
      const si = cols.indexOf('status');
      if (si < 0) continue;
      for (const r of rows.slice(2)) {
        const v = (r.split('|').slice(1, -1)[si] ?? '').trim().replace(/`/g, '').toLowerCase();
        if (v && !LEDGER_STATUSES.includes(v)) err(lineOf(text, text.indexOf(r)), 'ledger-status', `상태 "${v}" 는 ${LEDGER_STATUSES.join('·')} 가 아니다`);
      }
    }
  }

  if (!strict) {
    for (const e of errors.splice(0)) warnings.push({ ...e, message: `${e.message} (옛 형식이라 경고로 낮춤)` });
  }
  return { kind, stack, strict: Boolean(strict), errors, warnings };
}

/** 파일 하나를 검사한다. 같은 폴더의 requirements.md 를 FR 참조 확인에 쓴다. */
export function validateFile(path, { kind } = {}) {
  const det = kind ? { kind, stack: detectKind(path)?.stack ?? null } : detectKind(path);
  if (!det) return { path, kind: null, errors: [{ line: 1, rule: 'kind', message: '산출물 종류를 알 수 없다 — --kind 로 정한다' }], warnings: [], strict: true };
  const text = readFileSync(path, 'utf8');
  const reqPath = join(dirname(path), 'requirements.md');
  const siblings = { path, requirements: existsSync(reqPath) && det.kind !== 'requirements' ? readFileSync(reqPath, 'utf8') : null };
  return { path, ...validateSpec(text, { ...det, siblings }) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const ki = args.indexOf('--kind');
  const kind = ki >= 0 ? args[ki + 1] : undefined;
  const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--kind');
  const results = files.map((f) => validateFile(f, { kind }));
  if (args.includes('--json')) process.stdout.write(JSON.stringify(results, null, 2) + '\n');
  else for (const r of results) {
    process.stdout.write(`${r.path} (${r.kind ?? '?'}${r.strict ? '' : ', 옛 형식'}) — 오류 ${r.errors.length} · 경고 ${r.warnings.length}\n`);
    for (const e of r.errors) process.stdout.write(`  ✗ ${e.line}: [${e.rule}] ${e.message}\n`);
    for (const w of r.warnings) process.stdout.write(`  ! ${w.line}: [${w.rule}] ${w.message}\n`);
  }
  process.exit(results.some((r) => r.errors.length) ? 1 : 0);
}
