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

// ── 묶음 D: 개발자 문서(handbook) ─────────────────────────────────────
// 독자가 개발자다. 개발 용어는 살리고, 대신 인쇄를 깨는 이모지와 설명서를 매뉴얼로
// 만드는 지시문을 막는다. 알고리즘 서술의 '판단하다'는 의인화가 아니다
// (`라우터가 경로를 판단한다`는 정상, `앱이 사용자를 이해한다`는 위반).
const HANDBOOK_C1_ALLOW_RE = /(?:판단|결정|선택|해석)/;
/**
 * D6 — 문서 뼈대에 숨는 번역투 전문용어. 장 제목·표 머리는 본문보다 눈에 덜 띄어
 * 규칙을 빠져나간다. 실제로 arc42 목차를 그대로 옮긴 「빌딩블록과 계층」·「횡단 관심사」가
 * 한 판을 통째로 통과했다. 개발 용어는 살리되(C3 완화) **직역한 학술 용어**는 막는다.
 */
/**
 * D7 — 문서를 만든 과정이 문서에 새는 것. 독자는 우리가 어떻게 알아냈는지가 아니라
 * 코드가 어떤지를 읽는다. 실제로 "분석 스크립트가 …판정을 못 냈다" 로 시작하는 문단이
 * 한 판에 실려 나갔고, 근거 블록이 자기 산출물(structure.json)을 인용하는 순환도 있었다.
 */
const D7_LEAKS = [
  { re: /분석\s?스크립트/g, hint: '문서를 만든 과정은 독자와 상관없다 — 코드 사실만 적는다' },
  { re: /structure\.json/g, hint: '자기 산출물을 근거로 대지 않는다 — 실제 코드 파일이나 git 을 인용한다' },
  { re: /docs\/handbook\/(?:inventory\.md|traces)/g, hint: '분석 중간물은 문서에 등장하지 않는다' },
  { re: /flowCandidates|multiOwner|byTarget/g, hint: '분석 도구의 내부 이름이다 — 사람 말로 바꾼다' },
  { re: /`?file:fs`?/g, hint: '분석 도구가 붙인 꼬리표다 — 실제 저장소 이름으로 바꾼다' },
  { re: /\/dt-handbook\b/g, hint: '이 문서를 만든 도구를 문서 안에서 말하지 않는다' },
];
const D6_TERMS = [
  { re: /빌딩\s?블록/g, hint: '구성 요소' },
  { re: /런타임\s?뷰/g, hint: '동작 순서' },
  { re: /횡단\s?관심사/g, hint: '전체에 공통으로 걸리는 것' },
  { re: /시스템\s?컨텍스트/g, hint: '바깥과 주고받는 것' },
  { re: /관리\s?주체/g, hint: '누가 관리하나' },
  { re: /저장소\s?지도/g, hint: '폴더 구조' },
  { re: /아키텍처\s?뷰/g, hint: '구조 설명' },
  { re: /유즈\s?케이스/g, hint: '사용 흐름' },
];
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;
const IMPERATIVE_RE = /[가-힣](?:세요|십시오|시기\s?바랍니다)/g;

// ── 묶음 E: 사람이 쓴 글의 결 (산문 문서 공통) ────────────────────────
// A~D 는 낱말과 문장을 본다. E 는 문서의 결을 본다 — 표가 절을 다 먹었는지,
// 문장 길이가 균일한지, 나열이 설명을 대신하는지. 낱말을 다 지켜도 읽기 힘든
// 글이 나오는 층이라 따로 둔다. 판정은 전부 MINOR 다(사람이 고칠 힌트).
const PROSE_DOC_TYPES = new Set(['guide', 'confluence', 'explain', 'handbook']);
/** 한 절에서 표가 이만큼을 넘고 산문 문장이 이보다 적으면 표를 잘못 고른 것이다. */
const E1_TABLE_RATIO = 0.5;
const E1_MIN_PROSE_SENTENCES = 3;
/** 표가 이보다 짧으면(머리·구분선 포함) 곁들인 표다 — 절을 먹었다고 보지 않는다. */
const E1_MIN_TABLE_LINES = 5;
/** 이만큼 연속으로 긴 문장만 이어지면 리듬이 없다. */
const E2_LONG_RUN = 6;
const E2_LONG_CHARS = 25;
/** 불릿이 이만큼 연달아 오면 나열이 설명을 대신하고 있다. */
const E3_BULLET_RUN = 8;

/** 절(##·###) 단위로 갈라 각 절의 시작 줄과 줄 목록을 돌려준다. */
function splitProseSections(lines) {
  const out = [];
  let cur = { start: 1, heading: '', lines: [] };
  lines.forEach((line, i) => {
    if (/^#{2,3}\s/.test(line)) {
      if (cur.lines.length > 0 || cur.heading) out.push(cur);
      cur = { start: i + 1, heading: line, lines: [] };
    } else cur.lines.push(line);
  });
  out.push(cur);
  return out;
}

/** 묶음 E 판정 — 절 단위 구조를 본다. findings 를 그대로 돌려준다. */
export function lintProseShape(text) {
  const findings = [];
  const lines = text.split('\n');
  for (const sec of splitProseSections(lines)) {
    const body = sec.lines.filter((l) => l.trim() !== '');
    if (body.length === 0) continue;
    const tableLines = body.filter((l) => /^\s*\|/.test(l)).length;
    const proseSentences = body
      .filter((l) => !/^\s*[|>#`-]|^\s*\d+\.|^\s*</.test(l))
      .join(' ')
      .split(/(?<=[.!?])\s+/)
      .filter((x) => x.trim().length > 0).length;

    if (tableLines >= E1_MIN_TABLE_LINES && tableLines / body.length > E1_TABLE_RATIO && proseSentences < E1_MIN_PROSE_SENTENCES) {
      findings.push({ line: sec.start, col: 1, rule: 'E1', id: 'L-E1-table-only', match: sec.heading.trim() || '(절)',
        hint: '표가 절을 다 먹었다 — 중요한 두세 항목은 문단으로 풀고 표에는 눈으로 훑는 것만 남긴다' });
    }
    if (sec.heading && proseSentences === 0 && body.length > 0) {
      findings.push({ line: sec.start, col: 1, rule: 'E6', id: 'L-E6-no-lead', match: sec.heading.trim(),
        hint: '도입 문장 없이 표·그림으로 시작한다 — 이 절이 무엇을 말하는지 한 문장 쓰고 연다' });
    }

    let longRun = 0;
    let bulletRun = 0;
    sec.lines.forEach((line, i) => {
      const isBullet = /^\s*[-*]\s/.test(line);
      bulletRun = isBullet ? bulletRun + 1 : 0;
      if (bulletRun === E3_BULLET_RUN) {
        findings.push({ line: sec.start + i, col: 1, rule: 'E5', id: 'L-E5-bullet-run', match: line.trim().slice(0, 30),
          hint: '불릿이 길게 이어진다 — 나열이 설명을 대신하고 있다. 묶거나 문장으로 푼다' });
      }
      if (/^\s*[|>#`-]|^\s*\d+\.|^\s*</.test(line) || line.trim() === '') { longRun = 0; return; }
      for (const sent of line.split(/(?<=[.!?])\s+/)) {
        const t = sent.trim();
        if (t.length === 0) continue;
        longRun = t.length >= E2_LONG_CHARS ? longRun + 1 : 0;
        if (longRun === E2_LONG_RUN) {
          findings.push({ line: sec.start + i, col: 1, rule: 'E2', id: 'L-E2-rhythm', match: t.slice(0, 30),
            hint: '긴 문장만 이어진다 — 중요한 사실을 짧은 문장으로 끊어 눈에 걸리게 한다' });
        }
      }
    });
  }
  return findings;
}

/**
 * D8 의 기계 검사 한 갈래 — 근거 없는 수치. 숫자만 적으면 독자는 그것이 큰지 작은지 모른다.
 * 문단에 근거 뱃지도 파일 인용도 없이 수치가 있으면 짚는다. 나머지 네 질문(주장·왜·증상·
 * 첫 등장 풀이)은 기계가 못 본다 — 리뷰어 몫이다.
 */
const D8_NUMBER_RE = /(?<![\d.])\d{1,4}(?:,\d{3})*\s*(?:턴|번|회|건|개|줄|채널|초|분|시간|일|주|개월|%|KB|MB|GB)/g; // 조사가 바로 붙으므로 뒤를 막지 않는다
const D8_EVIDENCE_RE = /ev-(?:code|doc|guess)|\([\w./-]+\.\w+:\d+\)|`[\w./-]+\.\w+`/;
const D8_SKIP_LINE_RE = /^\s*(?:[|>#`]|<|-\s|\d+\.\s)/;

/** 문단(빈 줄로 갈린 산문 덩어리) 단위로 근거 없는 수치를 찾는다. */
export function lintUnbackedNumbers(rawLines) {
  const findings = [];
  let buf = [];
  let start = 0;
  const flush = () => {
    if (buf.length === 0) return;
    const text = buf.join(' ');
    if (!D8_EVIDENCE_RE.test(text)) {
      D8_NUMBER_RE.lastIndex = 0;
      let m;
      while ((m = D8_NUMBER_RE.exec(text))) {
        findings.push({ line: start, col: 1, rule: 'D8', id: 'L-D8-bare-number', match: m[0].trim(),
          hint: '무엇을 재서 나온 값인지, 무엇과 견주는 값인지를 함께 적는다 — 숫자만 있으면 크고 작음을 모른다' });
      }
    }
    buf = [];
  };
  rawLines.forEach((line, i) => {
    if (line.trim() === '' || D8_SKIP_LINE_RE.test(line)) { flush(); return; }
    if (buf.length === 0) start = i + 1;
    buf.push(line);
  });
  flush();
  return findings;
}

// ── C3-d: 영어 개발 은어의 직역 (산문 문서 공통) ──────────────────────
// C3-c 가 우리말 구어라면 이쪽은 영어 은어를 그대로 옮긴 것이다. 개발 맥락이라고
// 허용되지 않는다 — 뜻이 같은 우리말이 있다. "개발 용어는 그대로" 라는 완화 한 줄
// 때문에 "배포물에 구운 .env" 가 한 판 통째로 통과했다.
// 오탐을 막으려고 **문장 안에 맥락 낱말이 함께 있을 때만** 잡는다.
const C3D_RULES = [
  { key: 'bake',  verb: /구운|굽는|굽고|구워|굽는다/,        ctx: /빌드|배포|설치본|산출물|번들|이미지|\.env/, hint: '빌드할 때 함께 넣는다' },
  { key: 'emit',  verb: /흘린다|흘리고|흘려|흘리는/,          ctx: /로그|진행|화면|출력|이벤트/,                hint: '내보낸다' },
  { key: 'kill',  verb: /죽는다|죽으면|죽이면|죽였|죽인다/,   ctx: /프로세스|서버|앱|연결|스레드|워커/,          hint: '멈춘다 · 끝낸다' },
  { key: 'drop',  verb: /떨어뜨린다|떨어뜨리고|떨어뜨려/,     ctx: /요청|패킷|이벤트|메시지|프레임/,            hint: '버린다' },
  { key: 'hit',   verb: /밟는다|밟게|밟은다|다시 밟/,         ctx: /함정|버그|사고|결함|지뢰|경로/,              hint: '걸린다 · 겪는다' },
  { key: 'fire',  verb: /쏜다|쏘고|쏜 뒤/,                    ctx: /요청|이벤트|쿼리|호출/,                      hint: '보낸다' },
  { key: 'path',  verb: /경로를 탄다|경로를 타면|경로를 타/,  ctx: /증분|캐시|빠른|느린/,                        hint: '경로를 쓴다' },
  { key: 'ride',  verb: /태워 보낸|태워서 보낸|태운다/,       ctx: /응답|요청|헤더|페이로드|본문/,               hint: '실어 보낸다' },
];

/** 문장 단위로 본다 — 맥락 낱말이 같은 문장에 있어야 잡는다(관용구 오탐 방지). */
export function lintTranslationeseVerbs(rawLines) {
  const findings = [];
  rawLines.forEach((raw, i) => {
    if (/^\s*(?:[|>#`]|<)/.test(raw)) return;          // 표·인용·제목·코드·태그 줄은 건너뛴다
    const line = raw.replace(/`[^`]*`/g, ' ');          // 백틱 안은 검사하지 않는다
    for (const sent of line.split(/(?<=[.!?])\s+/)) {
      for (const r of C3D_RULES) {
        if (r.verb.test(sent) && r.ctx.test(sent)) {
          findings.push({ line: i + 1, col: 1, rule: 'C3-d', id: `L-C3d-${r.key}`,
            match: (r.verb.exec(sent) ?? [''])[0], hint: `${r.hint} — 영어 은어를 그대로 옮기지 않는다` });
        }
      }
    }
  });
  return findings;
}

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
    for (const { col, match } of findAll(line, C1_RE)) {
      if (docType === 'handbook' && HANDBOOK_C1_ALLOW_RE.test(match)) continue;
      push('C1', 'L-C1-anthro', col, match, '기계 동작 동사나 상태 서술로');
    }
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
    if (docType === 'handbook') {
      for (const { col, match } of findAll(line, EMOJI_RE)) {
        push('D3', 'L-D3-emoji', col, match, '[코드]·[문서]·[추정] 뱃지로 — 이모지는 PDF 임베드가 불안정하다');
      }
      for (const { col, match } of findAll(line, IMPERATIVE_RE)) {
        push('D5', 'L-D5-imperative', col, match, '핸드북은 설명서다 — 절차 지시는 링크로 넘긴다');
      }
      for (const t of D6_TERMS) {
        for (const { col, match } of findAll(line, t.re)) {
          push('D6', 'L-D6-jargon', col, match, `${t.hint} — 직역한 학술 용어는 제목에서도 쓰지 않는다`);
        }
      }
      // D7 은 **원문 줄**을 본다 — 도구 이름은 대개 백틱 안에 있어 마스킹된 줄에서는 안 보인다.
      for (const t of D7_LEAKS) {
        for (const { col, match } of findAll(raw, t.re)) {
          push('D7', 'L-D7-process-leak', col, match, t.hint);
        }
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

  if (PROSE_DOC_TYPES.has(docType)) {
    findings.push(...lintProseShape(masked));
    findings.push(...lintTranslationeseVerbs(rawLines));
  }
  if (docType === 'handbook') findings.push(...lintUnbackedNumbers(rawLines));

  findings.sort((a, b) => a.line - b.line || a.col - b.col);
  return { findings, stats: { lines: lines.length, sentences: countSentences(masked), kept } };
}

// ── CLI ───────────────────────────────────────────────────────────────
function formatTable(result) {
  const rows = result.findings.map((f) => `${f.line}:${f.col} [${f.id}] "${f.match}" — ${f.hint}`);
  rows.push(`findings ${result.findings.length} · kept ${result.stats.kept} · lines ${result.stats.lines} · sentences ${result.stats.sentences}`);
  return rows.join('\n');
}

const DOC_TYPES = ['jira', 'confluence', 'guide', 'explain', 'spec', 'handbook'];
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
