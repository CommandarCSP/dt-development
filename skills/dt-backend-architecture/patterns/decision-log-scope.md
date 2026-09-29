---
ruleId: decision-log-scope
summary: "결정 로그 주석은 Service에만 — Controller/Repository/DTO에는 쓰지 않는다"
severity: minor
appliesTo: ["src/**/*.controller.ts", "src/**/*.repository.ts", "src/**/dto/*.ts"]
detection:
  - type: forbidden-pattern
    description: "허용 레이어(Service) 밖의 결정 로그 블록 — `- YYYY-MM · 출처:` 항목을 가진 주석"
    rationale: "비즈니스 규칙이 Controller/Repository에 있다면 주석을 달 게 아니라 Service로 옮겨야 함"
relatedRules: [decision-log-format, controller-no-business-logic]
---

# 결정 로그는 Service에만

## 왜 중요한가
결정 로그는 비즈니스 규칙의 변천을 남기는 장치다. 규칙의 주인은 Service이므로 로그도 거기 있어야 한다. Controller나 Repository에 결정 로그가 생겼다는 것은 대개 비즈니스 규칙이 잘못된 레이어로 샜다는 신호다.

## ❌ Incorrect

```ts
// src/reservations/reservations.controller.ts
/**
 * 확정 시점: PG 웹훅 수신 후
 * - 2026-09 · PROJ-412(정산팀): 웹훅 수신까지 보류. 정산 마감 초과 방지
 */
@Post(':id/confirm')
async confirm(...) { }
```

## ✅ Correct

```ts
// src/reservations/reservations.controller.ts
@Post(':id/confirm')
async confirm(@Param('id') id: string) {
  return this.reservationsService.confirmReservation(id);
}
```

로그는 규칙이 사는 `reservations.service.ts` 의 `confirmReservation` 위에 둔다.

## 관련 규칙
- `decision-log-format` — 허용 레이어에서의 형식
- 전체 규칙: [결정 로그 주석](../../../docs/refs/decision-log-comments.md)
