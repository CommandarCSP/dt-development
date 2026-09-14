import { createHash } from 'node:crypto';

// WHY: e2e 원장의 basedOnSpec stale 판정을 whole-file(git hash) 비교에서 **내용 기반** 비교로
// 바꾸기 위한 공용 헬퍼. dt-e2e(requirements.md)·dt-be-e2e(api-contract.md)가 공유한다.
// git hash는 HTML 주석-only 변경(역참조 emit 등)에도 바뀌어 오탐을 낸다 — 계약부 실내용이
// 그대로면 stale이 아니어야 한다. 그래서 주석 제거·공백 정규화 후 본문 해시를 기준으로 삼는다.

// WHY: 계약부 정규화 — ① HTML 주석(<!-- ... -->) 전부 제거(주석-only 변경 무시),
// ② 공백(개행·탭·연속 스페이스) 1칸으로 접기, ③ 양끝 트림. 포맷팅 diff도 흡수한다.
export function normalizeContent(markdown) {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// WHY: 정규화된 계약부 본문의 sha256 앞 8자. 마커에 content:<해시8>로 병기해
// 수집 1단계가 현재 파일 해시와 비교(다르면 실변경 → stale).
export function specContentHash(markdown) {
  return createHash('sha256')
    .update(normalizeContent(markdown), 'utf8')
    .digest('hex')
    .slice(0, 8);
}
