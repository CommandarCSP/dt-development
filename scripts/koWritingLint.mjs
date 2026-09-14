/**
 * 한글 작성 규율(readable-writing.md 묶음 C)의 **확실한 패턴만** 정규식으로 짚는다.
 * 판정·수정은 하지 않는다 — 문맥 판단은 ko-writing-reviewer(LLM) 또는 author 에이전트가 한다.
 * 스펙: docs/specs/2026-09-12-ko-writing-discipline-design.md §6.
 *
 * 사전(INANIMATE_SUBJECTS·ANTHRO_VERB_STEMS·PLURAL_NOUNS·UNFAMILIAR_TERMS)은
 * readable-writing.md 의 C1·C2·C3 표와 같게 유지한다(표가 SOT).
 */
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ── 보호 구간 ─────────────────────────────────────────────────────────
const PROTECTED_RES = [
  /```[\s\S]*?```/g,              // 코드 블록
  /`[^`\n]+`/g,                    // 인라인 코드
  /https?:\/\/[^\s)>\]]+/g,        // URL
  /<!--[\s\S]*?-->/g,              // HTML 주석
];

/** 보호 구간을 같은 길이의 공백으로 바꾼다(줄바꿈은 유지 — line/col 보존). */
export function maskProtected(text) {
  let out = text;
  for (const re of PROTECTED_RES) {
    out = out.replace(re, (m) => m.replace(/[^\n]/g, ' '));
  }
  return out;
}

// ── 문장 경계 ─────────────────────────────────────────────────────────
/** 줄 안에서 문장이 시작하는 열(0-based) 목록. 마크다운 접두(불릿·번호·인용·헤더·표 셀) 뒤와 [.!?] 뒤. */
export function sentenceStarts(line) {
  const starts = [];
  const prefix = /^(\s*(?:[-*+]\s+|\d+\.\s+|>\s*|#+\s+|\|\s*)*)/.exec(line);
  starts.push(prefix ? prefix[1].length : 0);
  const boundary = /[.!?]\s+|\|\s*/g;
  let m;
  while ((m = boundary.exec(line)) !== null) {
    const idx = m.index + m[0].length;
    if (idx < line.length && idx !== starts[0]) starts.push(idx);
  }
  return starts;
}

function countSentences(masked) {
  let n = 0;
  for (const line of masked.split('\n')) {
    if (line.trim().length === 0) continue;
    n += sentenceStarts(line).filter((s) => line.slice(s).trim().length > 0).length;
  }
  return n;
}

// ── C2 번역투 ─────────────────────────────────────────────────────────
export const PLURAL_NOUNS = ['정보', '문제', '기능', '설정', '파일', '데이터', '결과', '항목', '내용', '방법', '단계', '화면'];

const C2_RULES = [
  { id: 'L-C2-passive', re: /에\s?의(?:해|한)/g, hint: '주어를 살려 능동으로' },
  { id: 'L-C2-through', re: /[을를]\s?통(?:해|한)/g, hint: '`에서`/`으로`로 바꿔도 뜻이 같은지 확인' },
  { id: 'L-C2-isseo', re: /에\s?있어(?:서)?(?=[\s,.]|$)/g, hint: '`~할 때`, `~에서`' },
  // 한글은 음절이 합성된다 — '보여진다'의 '진'은 '지'+'ㄴ'이 아니라 한 글자. 활용형 음절을 나열한다.
  { id: 'L-C2-double-passive', re: /(?:되어|보여|불리워|여겨)\s?(?:지|진|집|짐|질|졌)/g, hint: '홑 피동으로' },
  { id: 'L-C2-one-of', re: /중\s?하나/g, hint: '`특히 ~`, `~ 가운데`' },
  { id: 'L-C2-have', re: /[을를]\s?가(?:지|진|집|짐|질)/g, hint: '`~이 있다`' },
  { id: 'L-C2-due-to', re: /로\s?인(?:해|한)/g, hint: '`때문에`' },
  { id: 'L-C2-plural', re: new RegExp(`(?:${PLURAL_NOUNS.join('|')})들(?=[을를이가은는의도과와에만\\s,.]|$)`, 'g'), hint: '복수 표지 제거' },
];
const C2_PRONOUN_RE = /^(?:그것[은이]|그들[은이]|이것[은이])(?=\s|,)/;

function findAll(line, re) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(line)) !== null) {
    out.push({ col: m.index, match: m[0] });
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

// ── C1 의인화 (D2 "중간": 무생물 주어 + 사고·감정·의사소통 동사만) ──────────
export const INANIMATE_SUBJECTS = ['앱', '시스템', '화면', '버튼', '트레이', '설정', '서버', '기능', '프로그램', '서비스', '모듈'];
// 한글은 어간+어미가 한 음절로 합성된다('하'+'ㅂ니다' → '합니다', '주'+'ㅂ니다' → '줍니다').
// 어간 마지막 음절의 활용형을 클래스로 나열해야 '기억합니다'·'알려 줍니다'가 잡힌다.
const H = '[하합한할함해했]';          // ~하다 활용
const J = '[주줍준줄줌줘줬]';          // ~주다 활용
const D = '(?:되|됩|된|될|됨|돼|됐)';  // ~되다 활용
export const ANTHRO_VERB_STEMS = [
  `알려\\s?${J}`, `말${H}`, `기억${H}`, `이해${H}`, `판단${H}`, `원${H}`, `기대${H}`, `도와\\s?${J}`,
  '챙[기깁긴길김겨겼]', '품(?:고\\s?있|습니다|는다|었)', `고민${H}`, '신경\\s?[쓰씁쓴쓸씀써썼]', `노력${H}`,
];
const C1_RE = new RegExp(
  `(?:${INANIMATE_SUBJECTS.join('|')})(?:이|가|은|는)\\s+(?:[^\\s.,!?]+\\s+){0,3}?(?:${ANTHRO_VERB_STEMS.join('|')})`,
  'g',
);

// ── C3 낯선 용어 (readable-writing.md 치환표와 같게) ─────────────────
export const UNFAMILIAR_TERMS = [
  // '설치 수행 후'처럼 명사로 홀로 서는 경우도 잡는다(뒤가 공백·조사·문장부호면). 활용형은 위 H·D 클래스.
  { key: 'suhaeng', re: new RegExp(`수행(?:${H}|${D}|(?=[\\s을를이가은는,.)\\]:;!?]|$))`, 'g'), hint: '하다' },
  { key: 'jonjae', re: new RegExp(`존재${H}`, 'g'), hint: '있다' },
  { key: 'haedang', re: /해당\s(?=[가-힣])/g, hint: '그, 이' },
  { key: 'hwakbo', re: new RegExp(`확보(?:${H}|${D})`, 'g'), hint: '마련하다, 갖추다' },
  { key: 'soyo', re: new RegExp(`소요${D}`, 'g'), hint: '걸리다' },
  { key: 'balsaeng', re: new RegExp(`발생(?:${H}|${D})`, 'g'), hint: '생기다, 나다' },
  { key: 'wanryo', re: new RegExp(`완료${D}`, 'g'), hint: '끝나다' },
  { key: 'yogu', re: new RegExp(`요구${D}`, 'g'), hint: '필요하다' },
  { key: 'hwalyong', re: new RegExp(`활용${H}`, 'g'), hint: '쓰다' },
  { key: 'wichi', re: new RegExp(`위치${H}`, 'g'), hint: '있다' },
  { key: 'jinhaeng', re: new RegExp(`진행${H}(?!\\s*(?:상태|률|중|바))`, 'g'), hint: '하다' },
  { key: 'giin', re: new RegExp(`기인${H}`, 'g'), hint: '~ 때문이다' },
  { key: 'dochul', re: new RegExp(`도출(?:${H}|${D})`, 'g'), hint: '얻다, 뽑다' },
  { key: 'jegong', re: new RegExp(`제공${H}`, 'g'), hint: '주다, 있다 (사외 문서)' },
  { key: 'seontaek', re: /선택\s?가능/g, hint: '고를 수 있다' },
];
export const DEV_TERMS_GUIDE = ['빌드', '배포', '인스턴스', '캐시', '토큰'];

// ── C4 AI 티 ──────────────────────────────────────────────────────────
const C4_OPENER_RE = /^(?:결론적으로|주목할 점은|흥미롭게도|종합하면|요컨대)(?=\s|,)/;
const C4_CONJ_RE = /^(?:또한|따라서|그리고|하지만|그러나)(?=\s|,)/;

// ── keep 주석 · spec 예외 ─────────────────────────────────────────────
const KEEP_RE = /<!--\s*ko-lint:\s*keep\s+(L-C[1-4]-[a-z-]+)\b(?:(?!-->)[\s\S])*?-->/g;
// spec 모드: 줄 자체를 빼는 것은 요소 목록 줄·주석만. EARS 줄은 **키워드만 마스킹**하고 뒤따르는 한글 서술은
// 검사한다 — FR 본문("THE SYSTEM SHALL 해당 항목을 …")이 사람이 읽는 스펙의 대부분이다. 'IF-8' 같은
// 인터페이스 id 는 키워드가 아니다(`(?!-\d)`).
const SPEC_EXEMPT_LINE_RES = [
  /^\s*[-*]\s*`[^`]+`\s*\([^)]*\)\s*[—-]/,   // `id` (role) — 설명  요소·엔드포인트 목록
  /^\s*<!--.*-->\s*$/,                         // 주석만 있는 줄
];
const SPEC_MASK_RES = [
  /\*{0,2}\b(?:WHEN|WHILE|WHERE|THEN|THE SYSTEM SHALL)\b\*{0,2}/g,
  /\*{0,2}\bIF\b(?!-\d)\*{0,2}/g,
  /\[(?:ai-confirmed|ai-edited|user-added|inferred|user-resolved|Ubiquitous|Event-driven|State-driven|Optional|Complex|Unwanted)\]/g,
];

function keepIdsOf(rawLine) {
  const set = new Set();
  KEEP_RE.lastIndex = 0;
  let m;
  while ((m = KEEP_RE.exec(rawLine)) !== null) set.add(m[1]);
  return set;
}

// ── 메인 ──────────────────────────────────────────────────────────────
export function lintKoWriting(text, opts = {}) {
  const docType = opts.docType;
  const rawLines = text.split('\n');
  let masked = maskProtected(text);
  if (docType === 'spec') {
    for (const re of SPEC_MASK_RES) masked = masked.replace(re, (m) => ' '.repeat(m.length));
  }
  const lines = masked.split('\n');
  const findings = [];
  let kept = 0;
  let conjRun = 0;
  const devTermSeen = new Set();

  lines.forEach((line, i) => {
    const raw = rawLines[i];
    if (docType === 'spec' && SPEC_EXEMPT_LINE_RES.some((re) => re.test(raw))) { conjRun = 0; return; }
    const keepIds = keepIdsOf(raw);
    const push = (rule, id, col, match, hint) => {
      if (keepIds.has(id)) { kept++; return; }
      findings.push({ line: i + 1, col: col + 1, rule, id, match, hint });
    };

    // C2
    for (const r of C2_RULES) {
      for (const { col, match } of findAll(line, r.re)) push('C2', r.id, col, match, r.hint);
    }
    // C1
    for (const { col, match } of findAll(line, C1_RE)) push('C1', 'L-C1-anthro', col, match, '기계 동작 동사나 상태 서술로');
    // C3
    for (const t of UNFAMILIAR_TERMS) {
      for (const { col, match } of findAll(line, t.re)) push('C3', `L-C3-${t.key}`, col, match, t.hint);
    }
    if (docType === 'guide') {
      for (const term of DEV_TERMS_GUIDE) {
        if (devTermSeen.has(term)) continue;
        const idx = line.indexOf(term);
        if (idx === -1) continue;
        devTermSeen.add(term);
        const after = line.slice(idx + term.length);
        if (!/^\s*\(/.test(after)) push('C3', 'L-C3-devterm', idx, term, '첫 등장에서 괄호로 풀어 쓰거나 일상어로');
      }
    }
    // 문장 첫머리 규칙 (C2 대명사 · C4 도입구 · C4 접속사 연속)
    if (line.trim().length === 0) conjRun = 0;
    for (const s of sentenceStarts(line)) {
      const rest = line.slice(s);
      if (rest.trim().length === 0) continue;
      let m = C2_PRONOUN_RE.exec(rest);
      if (m) push('C2', 'L-C2-pronoun', s, m[0], '대명사 생략 또는 지시 대상 명시');
      m = C4_OPENER_RE.exec(rest);
      if (m) push('C4', 'L-C4-opener', s, m[0], '지우고 본론으로');
      m = C4_CONJ_RE.exec(rest);
      if (m) {
        conjRun++;
        if (conjRun === 3) push('C4', 'L-C4-conj', s, m[0], '연속 3문장이 접속사로 시작 — 줄이기');
      } else {
        conjRun = 0;
      }
    }
  });

  findings.sort((a, b) => a.line - b.line || a.col - b.col);
  return { findings, stats: { lines: lines.length, sentences: countSentences(masked), kept } };
}

// ── CLI ───────────────────────────────────────────────────────────────
function formatTable(result) {
  const rows = result.findings.map((f) => `${f.line}:${f.col} [${f.id}] "${f.match}" — ${f.hint}`);
  rows.push(`findings ${result.findings.length} · kept ${result.stats.kept} · lines ${result.stats.lines} · sentences ${result.stats.sentences}`);
  return rows.join('\n');
}

const DOC_TYPES = ['jira', 'confluence', 'guide', 'explain', 'spec'];
const USAGE = `Usage: node scripts/koWritingLint.mjs <file.md> [--json] [--docType ${DOC_TYPES.join('|')}]\n`;

// exit 계약: findings 0 → 0, 있음 → 1. 사용법·IO 오류만 2 (게이트가 둘을 구분해야 한다).
function main(argv) {
  const args = argv.slice(2);
  // 플래그를 먼저 걷어낸다 — '--docType spec in.md'처럼 값이 앞서도 파일을 오해하지 않게 값 토큰을 건너뛴다.
  const positionals = [];
  let json = false;
  let docType;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--json') json = true;
    else if (a === '--docType') docType = args[++i];
    else if (a.startsWith('--')) { process.stderr.write(USAGE); return 2; }
    else positionals.push(a);
  }
  const file = positionals[0];
  if (!file || (docType !== undefined && !DOC_TYPES.includes(docType))) {
    process.stderr.write(USAGE);
    return 2;
  }
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (err) {
    process.stderr.write(`❌ 파일을 읽지 못했다: ${file} (${err.code})\n`);
    return 2;
  }
  const result = lintKoWriting(text, { docType });
  process.stdout.write((json ? JSON.stringify(result, null, 2) : formatTable(result)) + '\n');
  return result.findings.length === 0 ? 0 : 1;
}

const isMain = (() => {
  try {
    return process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();
if (isMain) process.exit(main(process.argv));
