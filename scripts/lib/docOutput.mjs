/**
 * 가이드·핸드북 PDF 가 함께 쓰는 출력 설정 — 버전 출처·티켓 키 판정·테마·용지·문서 언어 문구.
 * 소비처: scripts/guide/{config,build,gate}.mjs, scripts/handbook/{gate,build,render}.mjs.
 * 키 설명: docs/refs/doc-output.md.
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { resolveWorklogConfig } from '../worklogConfig.mjs';

// ── 버전 출처 ─────────────────────────────────────────────────────────
export const VERSION_SOURCES = ['auto', 'package.json', 'Cargo.toml', 'pyproject.toml', 'git-tag'];
const SEMVER_IN = /\d+\.\d+\.\d+(?:[-+][\w.-]+)?/;

const readText = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

/** TOML 의 `[section]` 안에서 `version = "x.y.z"` 를 찾는다. 파서 없이 — 필요한 건 한 줄이다. */
function tomlVersion(text, sections) {
  let current = '';
  for (const line of text.split('\n')) {
    const h = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (h) { current = h[1].trim(); continue; }
    if (!sections.includes(current)) continue;
    const m = /^\s*version\s*=\s*["']([^"']+)["']/.exec(line);
    if (m) return m[1];
  }
  return null;
}

const READERS = {
  'package.json': (root) => {
    const t = readText(join(root, 'package.json'));
    if (t === null) return null;
    const v = JSON.parse(t).version;
    return typeof v === 'string' ? v : null;
  },
  'Cargo.toml': (root) => { const t = readText(join(root, 'Cargo.toml')); return t && tomlVersion(t, ['package', 'workspace.package']); },
  'pyproject.toml': (root) => { const t = readText(join(root, 'pyproject.toml')); return t && tomlVersion(t, ['project', 'tool.poetry']); },
  'git-tag': (root, runGit) => {
    try {
      const tag = runGit(['describe', '--tags', '--abbrev=0']).trim();
      const m = SEMVER_IN.exec(tag);
      return m ? m[0] : null;
    } catch { return null; }
  },
};

/**
 * 프로젝트 버전을 읽는다.
 * @param source auto(package.json → Cargo.toml → pyproject.toml) | 위 파일 이름 | git-tag | file:<경로>
 * @returns {{ version: string|null, from: string|null, error?: string }}
 */
export function readAppVersion(root, source = 'auto', { runGit } = {}) {
  const git = runGit ?? ((args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  if (typeof source === 'string' && source.startsWith('file:')) {
    const rel = source.slice(5).trim();
    const t = readText(join(root, rel));
    if (t === null) return { version: null, from: rel, error: `versionSource 의 파일이 없다: ${rel}` };
    const m = SEMVER_IN.exec(t);
    return m ? { version: m[0], from: rel } : { version: null, from: rel, error: `${rel} 에서 x.y.z 버전을 찾지 못했다` };
  }
  if (source === 'auto') {
    for (const name of ['package.json', 'Cargo.toml', 'pyproject.toml']) {
      const v = READERS[name](root);
      if (v) return { version: v, from: name };
    }
    return { version: null, from: null, error: 'package.json·Cargo.toml·pyproject.toml 어디에도 버전이 없다 — 설정의 versionSource 로 출처를 정한다(git-tag · file:<경로>)' };
  }
  if (!READERS[source]) return { version: null, from: null, error: `versionSource "${source}" 는 모른다 — ${VERSION_SOURCES.join(' | ')} | file:<경로>` };
  const v = READERS[source](root, git);
  return v ? { version: v, from: source } : { version: null, from: source, error: `${source} 에서 버전을 읽지 못했다` };
}

// ── 티켓 키 ───────────────────────────────────────────────────────────
/** 티켓 키처럼 생겼지만 표준 약어인 접두사 — UTF-8·ISO-8601·RFC-2119 … 어떤 패턴이든 이 접두사는 넘긴다. */
export const TICKET_KEY_ALLOW = new Set(['ISO', 'UTF', 'SHA', 'RFC', 'AES', 'HTTP', 'MP3', 'MP4', 'H2', 'CVE']);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 공개 문서에서 막을 티켓 키 패턴. 기본은 **끈다** — `ES-2015`·`PEP-8` 같은 일반 표기를 사내 티켓으로 오인하지 않게.
 * 순서: 문서 설정 ticketKeyPattern(false 면 끔) → 트래커 설정의 프로젝트 키(defaultProjectKey) → issueKeyPattern.
 * @returns {{ re: RegExp|null, from: string }}
 */
export function resolveTicketKeyRule(root, docConfig = {}, { worklog } = {}) {
  const own = docConfig.ticketKeyPattern;
  if (own === false) return { re: null, from: '설정(끔)' };
  if (typeof own === 'string' && own.trim()) return { re: new RegExp(`\\b(?:${own})\\b`, 'g'), from: '설정 ticketKeyPattern' };
  let project = worklog;
  if (project === undefined) {
    try { project = resolveWorklogConfig(root).project; } catch { project = null; }
  }
  const key = project?.defaultProjectKey;
  if (typeof key === 'string' && /^[A-Z][A-Z0-9]+$/.test(key)) return { re: new RegExp(`\\b${escapeRe(key)}-\\d+\\b`, 'g'), from: `트래커 프로젝트 키 ${key}` };
  const pat = project?.issueKeyPattern;
  if (typeof pat === 'string' && pat.trim()) return { re: new RegExp(`\\b(?:${pat})\\b`, 'g'), from: '트래커 issueKeyPattern' };
  return { re: null, from: '기본(끔)' };
}

/** 한 줄에서 티켓 키를 모두 찾는다(표준 약어 접두사는 뺀다). */
export function findTicketKeys(text, re) {
  if (!re) return [];
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  return [...text.matchAll(g)].map((m) => m[0]).filter((k) => !TICKET_KEY_ALLOW.has(k.split('-')[0]));
}

// ── 문서 언어 ─────────────────────────────────────────────────────────
/**
 * PDF 틀에 들어가는 문구만 언어를 따른다(목차 제목·문서 제목 꼬리·발췌 머리말·`<html lang>`).
 * 본문은 작성 에이전트가 쓴다 — 한글 검사·리뷰는 아직 언어와 상관없이 돈다(GEN-16 보류).
 */
export const DOC_LABELS = {
  ko: { toc: '목차', guideTitle: '사용 안내', handbookTitle: '개발 핸드북', excerpt: (v, n, d) => `이 문서는 전권 ${v} 에서 ${n}장만 뽑음 (${d})` },
  en: { toc: 'Contents', guideTitle: 'User Guide', handbookTitle: 'Developer Handbook', excerpt: (v, n, d) => `Excerpt of chapter ${n} from the full edition ${v} (${d})` },
};
export const docLabels = (language = 'ko') => (String(language).toLowerCase().startsWith('ko') ? DOC_LABELS.ko : DOC_LABELS.en);

// ── 테마 · 용지 ──────────────────────────────────────────────────────
/** 용지 폭(mm) — 그림 폭 검사가 인쇄 열 폭을 재현하는 데 쓴다. */
export const PAGE_SIZES = { A4: 210, A5: 148, Letter: 215.9, Legal: 215.9 };
export const MARGIN_X_MM = 32; // 좌우 16mm 씩

/** 인쇄 본문 폭(px @96dpi). A4 → 673. */
export const contentWidthPx = (pageSize = 'A4') => Math.round(((PAGE_SIZES[pageSize] ?? PAGE_SIZES.A4) - MARGIN_X_MM) / 25.4 * 96);

const COLOR_RE = /^(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|hsl)a?\([\d\s.,%/-]+\))$/;
const FONT_RE = /^[\w\s,'"-]+$/;

/**
 * 설정의 theme·pdf 를 확인해 돌려준다. 틀린 값은 경고하고 기본값.
 * @returns {{ theme: {accent?, font?, logo?}, pageSize: string, warnings: string[] }}
 */
export function resolveDocStyle(raw = {}) {
  const warnings = [];
  const theme = {};
  const t = raw.theme;
  if (t !== undefined && (typeof t !== 'object' || t === null || Array.isArray(t))) warnings.push('theme: 객체여야 한다 — 무시했다');
  else if (t) {
    for (const [k, v] of Object.entries(t)) {
      if (k === 'accent') (typeof v === 'string' && COLOR_RE.test(v.trim()) ? (theme.accent = v.trim()) : warnings.push(`theme.accent "${v}" 는 색이 아니다 — 기본색`));
      else if (k === 'font') (typeof v === 'string' && FONT_RE.test(v.trim()) ? (theme.font = v.trim()) : warnings.push(`theme.font "${v}" 는 글꼴 이름이 아니다 — 기본 글꼴`));
      else if (k === 'logo') (typeof v === 'string' && v.trim() ? (theme.logo = v.trim()) : warnings.push('theme.logo: 문서 폴더 기준 그림 경로여야 한다 — 무시했다'));
      else warnings.push(`알 수 없는 키 "theme.${k}" — 무시했다`);
    }
  }
  let pageSize = 'A4';
  const size = raw.pdf?.pageSize;
  if (size !== undefined) {
    if (Object.hasOwn(PAGE_SIZES, size)) pageSize = size;
    else warnings.push(`pdf.pageSize "${size}" 는 모른다 — ${Object.keys(PAGE_SIZES).join(' | ')} 중 하나. A4 로 둔다`);
  }
  return { theme, pageSize, warnings };
}

/** 테마 덮어쓰기 CSS — 기본 테마의 `{{THEME_CSS}}` 자리에 들어간다. 글꼴은 Pretendard 를 뒤에 남겨 한글이 비지 않게. */
export function themeCss(theme = {}) {
  const out = [];
  if (theme.accent) out.push(`:root{--accent:${theme.accent};--hb-accent:${theme.accent};}`);
  if (theme.font) out.push(`body{font-family:${theme.font}, Pretendard, -apple-system, BlinkMacSystemFont, sans-serif;}`);
  return out.join('\n');
}
