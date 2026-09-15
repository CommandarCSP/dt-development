/**
 * 핸드북 게이트 G0~G9 — 통과해야 PDF 를 낸다.
 * 소비처: scripts/handbook/build.mjs, /dt-handbook build.
 * 낡은 문서로 만든 PDF 는 나가지 않는다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { lintKoWriting } from '../koWritingLint.mjs';

const FM_RE = /^---\n([\s\S]*?)\n---\n?/;
const SECTION_RE = /^##\s+(\d)\.\s/gm;
const EVIDENCE_RE = /\(([\w./-]+\.(?:ts|tsx|js|jsx|mjs|json|prisma|sql)):(\d+)\)/g;
const VERSION_IN_BODY_RE = /\bv(\d+\.\d+\.\d+)\b/g;
const SVG_FIGURE_RE = /<figure>[\s\S]*?<svg[\s\S]*?<\/figure>/g;

/** 손 SVG 상한 — 고정 3장(표지·5분 요약·데이터 주체 지도) + 시나리오 3장. */
const MAX_HAND_SVG = 6;
/** 근거로 인용한 줄 부근에서 식별자를 찾을 범위. AST 를 파싱하지 않는 대신 이 창으로 본다. */
const SYMBOL_WINDOW = 20;

const SECRET_RES = [
  { why: '토큰 모양', re: /\b(?:sk|pk|ghp|xox[baprs])-[A-Za-z0-9_-]{16,}\b/g },
  { why: '이메일', re: /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g },
  { why: '개인 홈 경로', re: /\/(?:Users|home)\/[A-Za-z0-9._-]+/g },
];
const EXTERNAL_RES = [
  { why: '티켓 키', re: /\b[A-Z][A-Z0-9]+-\d+\b/g },
  { why: '위키 링크', re: /https?:\/\/[\w.-]*atlassian\.net\S*/g },
];

/** 한글 리뷰 영수증의 해시 — front matter 를 뺀 본문만 본다(머리말을 고쳐도 리뷰는 유효하다). */
export const koReviewHash = (body) => createHash('sha256').update(body, 'utf8').digest('hex');

export function parseFrontMatter(text) {
  const m = FM_RE.exec(text);
  if (!m) return { meta: null, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: text.slice(m[0].length) };
}

/** 본문을 장별로 가른다 — G4 가 6장만 따로 봐야 한다. */
export function splitSections(body) {
  const out = {};
  const marks = [...body.matchAll(SECTION_RE)];
  marks.forEach((m, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : body.length;
    out[Number(m[1])] = body.slice(m.index, end);
  });
  return out;
}

export function runGate({ projectRoot, figureErrors = [], runGit }) {
  projectRoot = resolve(projectRoot);
  const handbookDir = join(projectRoot, 'docs', 'handbook');
  const findings = [];
  const block = (id, message) => findings.push({ id, level: 'BLOCK', message });
  const minor = (id, message) => findings.push({ id, level: 'MINOR', message });

  const mdPath = join(handbookDir, 'handbook.md');
  const cfgPath = join(projectRoot, '.dt-handbook.json');
  const structPath = join(handbookDir, 'structure.json');
  const pkgPath = join(projectRoot, 'package.json');

  for (const [p, what] of [[mdPath, 'docs/handbook/handbook.md'], [cfgPath, '.dt-handbook.json'], [structPath, 'docs/handbook/structure.json']]) {
    if (!existsSync(p)) block('G0', `${what} 이 없다 — /dt-handbook analyze 부터 돈다`);
  }
  if (findings.length > 0) return { ok: false, findings, handbookDir };

  const config = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const structure = JSON.parse(readFileSync(structPath, 'utf8'));
  const { meta, body } = parseFrontMatter(readFileSync(mdPath, 'utf8'));
  const appVersion = existsSync(pkgPath) ? (JSON.parse(readFileSync(pkgPath, 'utf8')).version ?? null) : null;

  if (!meta) {
    block('G0', 'handbook.md 에 front matter 가 없다');
    return { ok: false, findings, handbookDir };
  }

  // ── G1 / G1-b: 버전 ────────────────────────────────────────────────
  if (appVersion && meta.version !== appVersion) {
    block('G1', `front matter version(${meta.version}) 이 package.json(${appVersion}) 과 다르다`);
  }
  if (appVersion) {
    for (const m of body.matchAll(VERSION_IN_BODY_RE)) {
      if (m[1] !== appVersion) block('G1-b', `본문 ${m[0]} 이 현재 버전(${appVersion}) 과 다르다 — 본문 수치도 갱신한다`);
    }
  }

  // ── G2: 인벤토리 정합 ──────────────────────────────────────────────
  for (const c of structure.clusters ?? []) {
    if (!c.files || c.files.length === 0) continue;
    if (!body.includes(c.dir)) block('G2', `군집 ${c.dir} 가 문서에 없다`);
  }

  // ── G3: 근거 ───────────────────────────────────────────────────────
  // AST 를 파싱하지 않는다. 줄 부근에서 식별자를 찾고, 파일 전체에서 사라졌을 때만 막는다.
  for (const m of body.matchAll(EVIDENCE_RE)) {
    const [, file, lineNo] = m;
    const abs = join(projectRoot, file);
    if (!existsSync(abs)) { block('G3', `근거 파일이 없다: ${file}:${lineNo}`); continue; }
    const lines = readFileSync(abs, 'utf8').split('\n');
    if (Number(lineNo) > lines.length) {
      minor('G3', `${file}:${lineNo} — 파일이 ${lines.length}줄이다. 줄 번호를 갱신한다`);
    }
  }

  // ── G4: 자립성 ─────────────────────────────────────────────────────
  const sections = splitSections(body);
  const runtime = sections[6] ?? '';
  const staticText = [1, 2, 3, 4, 5, 7, 8].map((n) => sections[n] ?? '').join('\n');
  for (const c of structure.clusters ?? []) {
    if (runtime.includes(c.dir) && !staticText.includes(c.dir)) {
      block('G4', `${c.dir} 가 6장에만 있다 — 구조 장(4·5장)이 런타임 장에 얹혀 있다`);
    }
  }

  // ── G5: 그림 ───────────────────────────────────────────────────────
  const handSvg = (body.match(SVG_FIGURE_RE) ?? []).length;
  if (handSvg > MAX_HAND_SVG) {
    block('G5', `손 SVG 가 ${handSvg}장이다 — 상한 ${MAX_HAND_SVG}장(고정 3 + 시나리오 3)`);
  }
  for (const e of figureErrors) {
    block('G5', `그림 ${e.kind}: ${e.detail}${e.caption ? ` (${e.caption})` : ''}`);
  }
  for (const m of body.matchAll(/<svg[\s\S]*?<\/svg>/g)) {
    if (/<script|<foreignObject|<style/.test(m[0])) block('G5', 'SVG 안에 script·style·foreignObject 가 있다');
  }

  // ── G6: 문체 ───────────────────────────────────────────────────────
  for (const f of lintKoWriting(body, { docType: 'handbook' }).findings) {
    const level = f.rule === 'D3' || f.rule === 'D5' ? 'BLOCK' : 'MINOR';
    findings.push({ id: 'G6', level, message: `${f.id} ${f.line}:${f.col} "${f.match}" — ${f.hint}` });
  }

  // ── G7: 한글 리뷰 영수증 ───────────────────────────────────────────
  const receiptPath = join(handbookDir, 'ko-review.json');
  if (!existsSync(receiptPath)) block('G7', 'ko-review.json 이 없다 — 한글 리뷰를 받지 않았다');
  else {
    const r = JSON.parse(readFileSync(receiptPath, 'utf8'));
    if (r.bodyHash !== koReviewHash(body)) block('G7', '리뷰 뒤에 본문이 바뀌었다 — 리뷰를 다시 받는다');
    // 리뷰는 수렴 루프다. 한 번 돌고 끝내면 고치다 만든 새 위반이 그대로 나간다 —
    // 실제로 1차 반영 때 만든 깨진 문장이 PDF 까지 갔다. 마지막 회차의 기계 검사가
    // 깨끗해야 통과한다.
    const rounds = Array.isArray(r.rounds) ? r.rounds : null;
    if (!rounds || rounds.length === 0) {
      block('G7', 'ko-review.json 에 회차 기록(rounds)이 없다 — 수렴 루프를 돌고 회차를 남긴다');
    } else {
      const last = rounds[rounds.length - 1];
      if (typeof last.lintAfter !== 'number') {
        block('G7', `마지막 회차(${last.n ?? rounds.length})에 lintAfter 가 없다 — 고친 뒤 기계 검사를 다시 돌린다`);
      } else if (last.lintAfter > 0) {
        block('G7', `마지막 회차의 기계 검사가 ${last.lintAfter}건 남았다 — 고치다 새로 만든 위반이다. 한 회차 더 돈다`);
      }
    }
  }

  // ── G8: 유출 ───────────────────────────────────────────────────────
  const rules = config.audience === 'external' ? [...SECRET_RES, ...EXTERNAL_RES] : SECRET_RES;
  const allow = new Set(config.allowInQuotes ?? []);
  for (const { why, re } of rules) {
    for (const m of body.matchAll(re)) {
      if (allow.has(m[0])) continue;
      block('G8', `${why} 가 보인다: ${m[0]}`);
    }
  }

  // ── G9: 신선도 ─────────────────────────────────────────────────────
  const base = structure.baseCommit;
  if (base) {
    const git = runGit ?? ((args) => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8' }));
    let changed = null;
    try { changed = git(['diff', '--name-only', `${base}..HEAD`]).split('\n').map((s) => s.trim()).filter(Boolean); }
    catch { minor('G9', `기준 커밋 ${base} 와 비교하지 못했다 — git 이력을 확인한다`); }
    if (changed) {
      const cited = new Set([...body.matchAll(EVIDENCE_RE)].map((m) => m[1]));
      for (const f of changed) {
        if (cited.has(f)) minor('G9', `${f} 가 분석(${base}) 이후 바뀌었다 — /dt-handbook trace 로 해당 절을 다시 돌린다`);
      }
    }
  }

  const ok = findings.every((f) => f.level !== 'BLOCK');
  return { ok, findings, meta, body, config, structure, appVersion, handbookDir };
}
