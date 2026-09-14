---
ruleId: module-registration
summary: "새 Controller/Provider는 형제 *.module.ts에 등록 — DI 와이어링 누락 금지"
severity: important
appliesTo: ["src/**/*.service.ts", "src/**/*.controller.ts", "src/**/*.repository.ts"]
excludePathPatterns: ["src/**/*.spec.ts", "src/**/*.test.ts", "src/**/__tests__/**"]
detection:
  - type: ast-rule
    description: "@Injectable/@Controller 클래스는 형제 모듈(*.module.ts)의 providers/controllers에 등록되어야 함 (v1: 수동 검토)"
    rationale: "DI 컨테이너에 등록되지 않은 provider/controller는 런타임에 해결 불가"
relatedRules: []
---

# Provider/Controller는 모듈에 등록한다

## 왜 중요한가
NestJS는 모듈의 `providers`/`controllers`에 선언된 클래스만 DI 컨테이너에서 해결한다. 새 Service/Repository/Controller를 만들고 모듈 등록을 빠뜨리면 런타임에 `Nest can't resolve dependencies` 에러가 난다. 또한 Service는 모듈의 `exports`에 넣어야 다른 모듈이 주입할 수 있다.

> v1에서는 모듈 그래프 분석이 필요해 `ast-rule` 수동 검토 stub로 표시된다. 추후 AST로 "선언됐지만 미등록" 클래스를 강제한다.

## ❌ Incorrect

```ts
// orders.service.ts 를 새로 만들었지만 모듈에 등록하지 않음
@Module({ controllers: [OrdersController] }) // providers에 OrdersService 누락
export class OrdersModule {}
```

## ✅ Correct

```ts
@Module({
  controllers: [OrdersController],
  providers: [OrdersService, OrdersRepository],
  exports: [OrdersService],
})
export class OrdersModule {}
```
