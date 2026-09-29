---
ruleId: decision-log-scope
summary: "결정 로그 주석은 Business Hook에만 — View/Domain Component/Store Query/Page에는 쓰지 않는다"
severity: minor
appliesTo: ["src/components/**/*.{ts,tsx}", "src/stores/**/*.{ts,tsx}", "src/pages/**/*.{ts,tsx}"]
detection:
  - type: forbidden-pattern
    description: "허용 레이어(Business Hook) 밖의 결정 로그 블록 — `- YYYY-MM · 출처:` 항목을 가진 주석"
    rationale: "비즈니스 규칙이 View나 Store Query에 있다면 주석을 달 게 아니라 Business Hook으로 옮겨야 함"
relatedRules: [decision-log-format, where-does-business-logic-go]
---

# 결정 로그는 Business Hook에만

## 왜 중요한가
결정 로그는 비즈니스 규칙의 변천을 남기는 장치다. 규칙의 주인은 Business Hook이므로 로그도 거기 있어야 한다. View나 Store Query에 결정 로그가 생겼다는 것은 대개 비즈니스 규칙이 잘못된 레이어로 샜다는 신호다.

## ❌ Incorrect

```tsx
// src/components/domain/ReservationCard.tsx
/**
 * 무료 취소 한도: 출발 48시간 전까지
 * - 2026-05 · PROJ-108(CS팀): 24시간에서 늘림. 취소 분쟁 문의가 많았음
 */
const cancelable = hoursUntilDeparture > 48;
```

## ✅ Correct

```tsx
// src/components/domain/ReservationCard.tsx
const { cancelable } = useReservationCancel(reservation);
```

로그는 규칙이 사는 `src/business/hooks/useReservationCancel.ts` 위에 둔다.

## 관련 규칙
- `decision-log-format` — 허용 레이어에서의 형식
- 전체 규칙: [결정 로그 주석](../../../docs/refs/decision-log-comments.md)
