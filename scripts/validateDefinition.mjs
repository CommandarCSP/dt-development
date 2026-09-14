import { parseDefinitionHeader, SPEC_VERSION } from './buildDefinitionHeader.mjs';

const REQUIRED_SECTIONS = [
  '## 전역 규약',
  '## 범위 분담',
  '## 인터페이스 합의',
  '## 변경 추적'
];
const STATE_LABEL_CELL = /^(확정|컨벤션|협의중|미해소)$/; // 칸 정확 일치(부분문자열 오탐 방지)
const STATE_LABEL_ANY = /미해소/;                          // status 산출용 IF 셀 스캔(부분매치 — '미해소(질문완료)' 포함)
const STRUCTURE_THRESHOLD = 50; // 식별 IF 중 wellFormed 비율 하한(%)

// WHY: '1.0' < '1.1' 점-구분 버전 비교. 반환 -1/0/1.
export function cmpVersion(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

export function validateDefinition(markdown) {
  const errors = [];
  const header = parseDefinitionHeader(markdown);
  const kind = header ? 'generated' : 'hand-authored';
  const specVersion = header ? header.specVersion : null;
  const definitionVersion = header ? header.definitionVersion : null;

  // 한 번의 순회로 누락 섹션 에러 누적 + sectionsOk 산출(이중 순회 desync 방지).
  let sectionsOk = true;
  for (const sec of REQUIRED_SECTIONS) {
    if (!markdown.includes(sec)) {
      errors.push(`필수 섹션 누락: ${sec}`);
      sectionsOk = false;
    }
  }

  // ID 화이트리스트: SP/IF/DM. 표 행 첫 칸만(줄-앵커로 본문 KEY-N 오탐 방지).
  const ID_CELL_REGEX = /^\s*\|\s*([A-Za-z]+-\d+)\s*\|/gm;
  let m;
  while ((m = ID_CELL_REGEX.exec(markdown)) !== null) {
    if (!/^(SP|IF|DM)-\d+$/.test(m[1])) {
      errors.push(`알 수 없는 항목 ID 접두사: ${m[1]} (SP-n/IF-n/DM-n만 허용)`);
    }
  }

  const ifRows = markdown.match(/^\s*\|\s*IF-\d+\s*\|.*$/gm) || [];
  const cells = (r) => r.split('|').map(s => s.trim()).filter(Boolean);

  // DM-n 구조: shape 셀(식별자 외 1개 이상) 필수. 섹션/행 없으면 검사 안 함(옵셔널·비파괴).
  const dmRows = markdown.match(/^\s*\|\s*DM-\d+\s*\|.*$/gm) || [];
  for (const r of dmRows) {
    const c = cells(r);
    if (c.length < 2) errors.push(`DM 행 구조 오류: ${c[0]} — shape 셀이 없음(필드·타입 1벌 필요)`);
  }

  let structureOk;
  if (!sectionsOk || ifRows.length === 0) {
    structureOk = false;
  } else {
    const isOldGenerated =
      (specVersion != null && cmpVersion(specVersion, SPEC_VERSION) < 0) ||
      (kind === 'generated' && specVersion == null);
    if (isOldGenerated) {
      structureOk = true;
    } else {
      // wellFormed = 셀 ≥3(식별자+내용+라벨) AND 어느 칸이 4-상태 라벨과 정확 일치.
      const wellFormed = ifRows.filter(r => {
        const c = cells(r);
        return c.length >= 3 && c.slice(1).some(cell => STATE_LABEL_CELL.test(cell));
      }).length;
      structureOk = wellFormed * 100 >= STRUCTURE_THRESHOLD * ifRows.length;
    }
  }

  // status: 헤더 우선, 없으면 IF 셀에 미해소 잔존 시 draft(산문 속 '미해소' 오탐 방지 — 설계 §8 ⑦).
  let status;
  if (header && header.status) status = header.status;
  else if (ifRows.some(r => cells(r).slice(1).some(cell => STATE_LABEL_ANY.test(cell)))) status = 'draft';
  else status = null;

  const valid = errors.length === 0 && structureOk;
  return { valid, errors, kind, structureOk, specVersion, status, definitionVersion };
}
