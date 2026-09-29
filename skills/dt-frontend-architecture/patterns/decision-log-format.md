---
ruleId: decision-log-format
summary: "Business Hook의 결정 로그 주석은 제목 줄 + 시간순 `- YYYY-MM · 출처: 무엇을. 왜.` 형식 — 이유 없는 출처 표기 금지"
severity: minor
appliesTo: ["src/business/hooks/**/*.{ts,tsx}"]
detection:
  - type: required-pattern
    description: "결정 로그 블록은 제목 줄로 시작하고 항목은 `- YYYY-MM · 출처: ` 형태여야 함"
    rationale: "제목 줄이 현재 규칙을 고정해야 로그가 길어져도 읽는 비용이 늘지 않음"
  - type: forbidden-pattern
    description: "출처만 있고 이유가 없는 결정 로그 항목 (예: `- 2026-05 · PROJ-108: 취소 한도 수정`)"
    rationale: "키만 남은 참조는 시간이 지나면 아무것도 말해주지 않음 — 기본 주석 규칙이 태스크 참조를 막던 이유"
  - type: forbidden-pattern
    description: "결정 로그 항목의 날짜가 내림차순 — 시간순 위반"
    rationale: "변천을 순서대로 읽을 수 있어야 함"
  - type: forbidden-pattern
    description: "결정 로그 항목이 추가된 diff인데 제목 줄이 그대로임 — 첫 줄 미갱신"
    rationale: "제목 줄이 현재 규칙과 어긋나면 주석이 거짓말을 시작함. 형식 검사보다 반 발 나간 항목이므로 부담되면 이 항목만 제거 가능"
relatedRules: [decision-log-scope, where-does-business-logic-go]
---

# 결정 로그 형식

## 왜 중요한가
결정 로그는 개수 상한이 없다. 대신 제목 줄이 항상 현재 규칙을 말하고 항목마다 이유가 붙어 있어야 그 무제한이 감당된다. 형식이 무너지면 로그는 그냥 긴 주석이 된다.

**블록이 있을 때만 검사한다.** 블록이 없는 것은 잡지 않는다 — 휴리스틱이라 오탐이 나고, 시달리면 형식만 갖춘 빈 블록을 달게 만든다.

## ❌ Incorrect

```ts
// src/business/hooks/useReservationCancel.ts
/**
 * - PROJ-108: 취소 한도 수정
 * - 2026-01 · 초기: 24시간 전까지
 */
export function useReservationCancel() { }
```

제목 줄이 없고, 첫 항목에 시점과 이유가 없으며, 순서가 뒤집혀 있다.

## ✅ Correct

```ts
// src/business/hooks/useReservationCancel.ts
/**
 * 무료 취소 한도: 출발 48시간 전까지
 * - 2026-01 · 초기: 24시간 전까지. 경쟁사 기준을 따름
 * - 2026-05 · PROJ-108(CS팀): 48시간으로 늘림.
 *   24시간 기준에서 취소 분쟁 문의가 전체 인입의 3할을 차지했음.
 */
export function useReservationCancel() { }
```

## 관련 규칙
- `decision-log-scope` — 허용 레이어 밖에는 쓰지 않는다
- 전체 규칙: [결정 로그 주석](../../../docs/refs/decision-log-comments.md)
