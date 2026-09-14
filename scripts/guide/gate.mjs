/**
 * 가이드 게이트 G1~G7 — 순수 함수. fs·git 을 모른다(shotExists 주입). 첫 실패에서 멈추지 않는다.
 * 기존 TS 구현(src/guide/{guide-meta,gate,changelog-items}.ts) 이식. 왼쪽 항이 CHANGELOG → 인벤토리(publishedItems)로 바뀌었고,
 * CHANGELOG 대조는 changelogItems 를 넘길 때만 추가로 한다. 스펙 §8-3.
 */
import { createHash } from 'node:crypto';
import { splitFrontMatter } from './frontMatter.mjs';

export const DEFAULT_FORBIDDEN_MARKERS = ['/Users/', 'GH_TOKEN', '.env.'];
/** 사내 티켓 키(PROJ-43·TASK-338 …) — 사외 PDF 에 나갈 수 없다. */
export const TICKET_KEY_RE = /\b[A-Z][A-Z0-9]+-\d+\b/;
/** 티켓 키처럼 생겼지만 표준 약어인 접두사 — UTF-8·ISO-8601·RFC-2119 … */
export const TICKET_KEY_ALLOW = new Set(['ISO', 'UTF', 'SHA', 'RFC', 'AES', 'HTTP', 'MP3', 'MP4', 'H2', 'CVE']);
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export function parseGuideSource(raw) {
  let fm;
  try { fm = splitFrontMatter(raw); } catch (err) { return { kind: 'failed', reason: `front matter 를 읽지 못했다: ${err.message}` }; }
  if (!fm) return { kind: 'failed', reason: 'front matter 가 없다 — version·manualShotsReviewedAt·covers 를 적어라.' };
  const d = fm.data;
  if (typeof d.version !== 'string' || !SEMVER_RE.test(d.version)) return { kind: 'failed', reason: `version 이 x.y.z 형식이 아니다: ${String(d.version)}` };
  if (typeof d.manualShotsReviewedAt !== 'string' || !SEMVER_RE.test(d.manualShotsReviewedAt)) return { kind: 'failed', reason: `manualShotsReviewedAt 이 x.y.z 형식이 아니다: ${String(d.manualShotsReviewedAt)}` };
  if (!Array.isArray(d.covers)) return { kind: 'failed', reason: 'covers 가 배열이 아니다(항목이 없으면 빈 배열로 둔다).' };
  const covers = [];
  for (const [i, c] of d.covers.entries()) {
    if (typeof c !== 'object' || c === null || typeof c.item !== 'string') return { kind: 'failed', reason: `covers[${i}] 에 item 문자열이 없다.` };
    covers.push({ item: c.item, ...(typeof c.shot === 'string' ? { shot: c.shot } : {}), ...(typeof c.section === 'string' ? { section: c.section } : {}), ...(typeof c.guide === 'string' ? { guide: c.guide } : {}), ...(typeof c.why === 'string' ? { why: c.why } : {}), ...(typeof c.capturedAt === 'string' ? { capturedAt: c.capturedAt } : {}) });
  }
  const meta = { version: d.version, manualShotsReviewedAt: d.manualShotsReviewedAt, covers };
  if (Array.isArray(d.changelogCovers)) meta.changelogCovers = d.changelogCovers.map(String);
  return { kind: 'ok', meta, body: fm.body };
}

const VERSION_HEADING_RE = /^##\s+\[([^\]]+)\]/;
const CATEGORY_HEADING_RE = /^###\s+(.+?)\s*$/;
const ITEM_RE = /^-\s+\*\*(.+?)\*\*/;

export function extractChangelogItems(markdown, version) {
  const items = [];
  let inSection = false, category = '';
  for (const line of markdown.split('\n')) {
    const h = VERSION_HEADING_RE.exec(line);
    if (h) { inSection = h[1] === version; category = ''; continue; }
    if (!inSection) continue;
    const c = CATEGORY_HEADING_RE.exec(line);
    if (c) { category = c[1]; continue; }
    const it = ITEM_RE.exec(line);
    if (it && it[1].trim()) items.push({ title: it[1].trim(), category });
  }
  return items;
}

const majorMinor = (v) => v.split('.').slice(0, 2).map(Number);
const isOlderLine = (a, b) => { const [am, an] = majorMinor(a), [bm, bn] = majorMinor(b); return am < bm || (am === bm && an < bn); };

/**
 * 그림에 보이면 안 되는 것들 — **프로젝트가 따로 안 적어도** 잡는다.
 *
 * 사외 공개 자산(GitHub 릴리스·Confluence)에 한 번 나가면 회수가 안 되는
 * 종류다. 실제로 한 판에서 설정 화면 그림에 개발자의 사내 이메일과 조직명이
 * 그대로 찍혀 나갈 뻔했다 — 그때 글 검사(G5)는 통과했다. 그림은 글이 아니라서다.
 */
const SHOT_PII_PATTERNS = [
  { name: '이메일', re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { name: '사용자 홈 경로', re: /(?:\/Users\/|\/home\/|C:\\Users\\)[A-Za-z0-9._-]+/g },
  { name: 'API 키 모양', re: /\b(?:sk-[A-Za-z0-9-]{12,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g },
  { name: '전화번호', re: /\b0\d{1,2}-\d{3,4}-\d{4}\b/g },
  { name: '주민번호 형태', re: /\b\d{6}-[1-4]\d{6}\b/g },
];

/**
 * G6 — **그림 속 글자** 검사.
 *
 * 스크린샷은 DOM 을 그린 것이라, 찍는 순간의 `innerText` 가 곧 그림에 보이는
 * 글자다. 그래서 OCR 도 새 의존성도 없이 검사할 수 있다(`capture.mjs` 가
 * 찍으면서 같은 텍스트를 떠 둔다).
 *
 * **못 보는 것**: 사람이 찍어 둔 `manual` 그림(DOM 이 없다), 운영체제가 그리는
 * 메뉴, canvas, 이미지 안의 글자. 그건 사람이 확인하는 몫으로 남긴다 —
 * 잡는 척하지 않는다.
 *
 * 같은 값이 여러 번 보여도 한 번만 낸다 — 같은 지적으로 목록을 덮으면 다른
 * findings 가 묻힌다.
 */
/** 리뷰가 본 본문을 못박는 해시. 본문만 본다 — front matter(covers 따위)는 글이 아니다. */
export function koReviewHash(body) {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

/**
 * G7 — **한글 리뷰가 지금 이 글을 봤는가.**
 *
 * 리뷰를 돌리든 말든 결과가 같으면 그 단계는 빠진다(실제로 빠졌다). 그래서
 * 리뷰가 흔적(`docs/guide/ko-review.json`)을 남기고 게이트가 그걸 본다 —
 * 이 레포가 테스트 영수증·가이드 영수증·캡처 수령증에 쓰는 것과 같은 방식이고,
 * G4(`manualShotsReviewedAt`)와도 같은 구도다.
 *
 * 본문 해시를 함께 보는 이유: 리뷰 **뒤에** 글을 고치면 그 리뷰는 지금 글을
 * 안 본 것이다. "돌리긴 했다" 로 통과시키면 장치가 반만 선다.
 */
export function checkKoReview({ review, body }) {
  const rerun = '`/dt-guide write` 의 한글 리뷰를 돌리고 docs/guide/ko-review.json 을 남겨라.';
  if (review === undefined || review === null) {
    return [{ gate: 'G7', message: `한글 리뷰 기록이 없다(docs/guide/ko-review.json). ${rerun}` }];
  }
  if (typeof review.bodyHash !== 'string' || review.bodyHash === '') {
    return [{ gate: 'G7', message: `한글 리뷰 기록에 bodyHash 가 없다 — 어느 글을 봤는지 알 수 없다. ${rerun}` }];
  }
  if (review.bodyHash !== koReviewHash(body)) {
    return [{ gate: 'G7', message: `한글 리뷰 뒤에 본문이 바뀌었다 — 그 리뷰는 지금 글을 보지 않았다. ${rerun}` }];
  }
  return [];
}

/** 받침이 있으면 '이', 없으면 '가' — "이메일가 보인다" 같은 말이 사용자에게 나가지 않게. */
function subjectParticle(word) {
  const last = word.codePointAt(word.length - 1);
  if (last === undefined || last < 0xac00 || last > 0xd7a3) return '가'; // 한글이 아니면 기본값
  return (last - 0xac00) % 28 === 0 ? '가' : '이';
}

export function checkShotText({ id, text, forbiddenMarkers = [], allowInShots = [] }) {
  const allow = new Set(allowInShots);
  const hits = new Map(); // 값 → 종류

  for (const { name, re } of SHOT_PII_PATTERNS) {
    for (const m of text.matchAll(re)) {
      if (allow.has(m[0])) continue;
      if (!hits.has(m[0])) hits.set(m[0], name);
    }
  }
  for (const marker of forbiddenMarkers) {
    if (allow.has(marker)) continue;
    if (text.includes(marker) && !hits.has(marker)) hits.set(marker, '사내 표지');
  }

  return [...hits].map(([value, kind]) => ({
    gate: 'G6',
    message: `${id} 그림에 ${kind}${subjectParticle(kind)} 보인다: "${value}". 공개 배포 자산에 나갈 수 없다 — 레시피의 redact 로 가리거나, 의도한 값이면 .dt-guide.json 의 allowInShots 에 적어라.`,
  }));
}

export function checkGuide({ meta, body, appVersion, inventoryItems, changelogItems, shotExists, forbiddenMarkers = DEFAULT_FORBIDDEN_MARKERS }) {
  const findings = [];
  const push = (gate, message) => findings.push({ gate, message });

  // G1
  if (meta.version !== appVersion) push('G1', `가이드 version(${meta.version})이 프로젝트 version(${appVersion})과 다르다 — 두 곳을 같은 값으로 맞춰라.`);

  // G2 — 인벤토리 양방향
  const seen = new Set(), dup = new Set();
  for (const c of meta.covers) (seen.has(c.item) ? dup : seen).add(c.item);
  for (const id of dup) push('G2', `covers 에 "${id}" 가 중복이다 — 한 항목은 한 번만 적는다.`);
  const covered = new Map(meta.covers.map((c) => [c.item, c]));
  const inventoryIds = new Set(inventoryItems.map((i) => i.id));
  for (const item of inventoryItems) {
    if (!covered.has(item.id)) push('G2', `가이드 미반영 — ${item.id} "${item.title}" (${item.kind}). covers 에 넣거나, guide: n/a + why 를 적어라.`);
  }
  for (const c of meta.covers) {
    if (c.guide === 'n/a') {
      if (!c.why || c.why.trim() === '') push('G2', `"${c.item}" 을 guide: n/a 로 넘기려면 why 가 필요하다.`);
      continue; // n/a 항목은 publish:false 였을 수 있어 "인벤토리에 없다" 로 잡지 않는다
    }
    if (!inventoryIds.has(c.item)) push('G2', `covers 의 "${c.item}" 이 인벤토리(publish) 에 없다 — id 오타이거나 publish:false 항목이다.`);
  }
  // G2 — CHANGELOG (선택)
  if (Array.isArray(changelogItems)) {
    const cl = new Set(meta.changelogCovers ?? []);
    for (const it of changelogItems) if (!cl.has(it.title)) push('G2', `CHANGELOG 미반영 — "${it.title}" (${it.category}). changelogCovers 에 넣어라.`);
    const titles = new Set(changelogItems.map((i) => i.title));
    for (const t of meta.changelogCovers ?? []) if (!titles.has(t)) push('G2', `changelogCovers 의 "${t}" 이 이번 버전 CHANGELOG 에 없다.`);
  }

  // G3 — 화면 항목의 그림
  const byId = new Map(inventoryItems.map((i) => [i.id, i]));
  for (const c of meta.covers) {
    const item = byId.get(c.item);
    if (!item || item.kind !== 'screen' || c.guide === 'n/a') continue;
    if (item.captureMode === 'none') continue;
    if (c.shot === undefined || c.shot === 'none') { push('G3', `${c.item} 은 화면(capture ${item.captureMode})인데 shot 이 없다 — 화면은 그림과 함께 설명한다(그림을 뺄 화면이면 인벤토리 capture.mode 를 none 으로).`); continue; }
    if (!shotExists(c.shot)) push('G3', `${c.item} 의 shot 파일이 없다: ${c.shot}`);
  }

  // G4
  if (isOlderLine(meta.manualShotsReviewedAt, meta.version)) push('G4', `MINOR 가 올랐다(${meta.manualShotsReviewedAt} → ${meta.version}). 수동·자동 그림이 아직 맞는지 확인하고 manualShotsReviewedAt 을 ${meta.version} 으로 올려라(다시 찍을 필요가 없으면 값만 올려도 된다).`);

  // G5
  body.split('\n').forEach((line, idx) => {
    for (const marker of forbiddenMarkers) if (line.includes(marker)) push('G5', `사내 표지 발견 — 본문 ${idx + 1}행의 "${marker}". 공개 배포 자산에 나갈 수 없다.`);
    for (const t of line.matchAll(new RegExp(TICKET_KEY_RE.source, 'g'))) {   // 한 줄에 여러 개면 전부
      if (TICKET_KEY_ALLOW.has(t[0].split('-')[0])) continue;
      push('G5', `티켓 키 발견 — 본문 ${idx + 1}행의 "${t[0]}". 공개 배포 자산에 나갈 수 없다.`);
    }
  });

  return findings.length === 0 ? { ok: true } : { ok: false, findings };
}
