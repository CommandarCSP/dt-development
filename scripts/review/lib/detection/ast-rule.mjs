// ast-rule — 예전 자리표 유형. 플러그인 규칙은 더 쓰지 않는다(GEN-40: 기계 검출 유형이나 manual 로 옮겼다).
// 팀이 따로 만든 규칙이 아직 이 유형을 쓰면 "사람 확인" 항목으로 리포트에 남긴다 — 조용히 사라지지 않게.

export function detectAstRule(_code, cfg) {
  return [{
    manualReview: true,
    hint: cfg.description || '사람 확인 규칙(ast-rule) — 규칙 문서를 보고 확인한다',
  }];
}
