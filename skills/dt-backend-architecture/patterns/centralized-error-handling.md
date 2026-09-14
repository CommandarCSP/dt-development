---
ruleId: centralized-error-handling
summary: "Controller에서 수동 HTTP 응답(res.status/res.send) 빌드 금지 — 전역 ExceptionFilter 사용"
severity: important
appliesTo: ["src/**/*.controller.ts"]
excludePathPatterns: ["src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**"]
detection:
  - type: forbidden-pattern
    pattern: "res[.](status|json|send)[ ]*[(]"
    rationale: "수동 응답 빌드는 전역 ExceptionFilter/직렬화 인터셉터를 우회 — 값 반환 + 예외 throw로 통일"
relatedRules: [service-no-http-context]
---

# 에러/응답은 전역 필터로 일원화

## 왜 중요한가
NestJS는 메서드 반환값을 자동 직렬화하고, 던져진 예외를 전역 `ExceptionFilter`가 일관된 형태로 변환한다. Controller가 `res.status().json()`으로 응답을 직접 만들면:
- 에러 응답 봉투(error envelope)가 엔드포인트마다 달라짐
- 전역 인터셉터(로깅/트레이싱/직렬화)를 우회
- `@Res()`를 쓰는 순간 Nest의 응답 파이프라인이 비활성화

Service는 도메인 예외를 throw하고, 전역 필터가 HTTP로 매핑한다.

## ❌ Incorrect

```ts
@Get(':id')
async findOne(@Param('id') id: string, @Res() res: Response) {
  const order = await this.orders.findOne(id);
  if (!order) return res.status(404).json({ error: 'not found' });
  return res.status(200).json(order);
}
```

## ✅ Correct

```ts
@Get(':id')
findOne(@Param('id') id: string): Promise<OrderResponseDto> {
  return this.orders.findOne(id); // 없으면 Service가 NotFoundException throw → 전역 필터가 404
}
```

## 관련 규칙
- [[service-no-http-context]]
