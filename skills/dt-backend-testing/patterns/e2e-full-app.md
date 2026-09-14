---
ruleId: e2e-full-app
summary: "E2E는 전체 AppModule을 실인프라(Testcontainers Postgres/Redis)+인증과 함께 부팅해 검증 — 수용 레이어(dt-be-e2e) 소유"
severity: important
appliesTo: ["test/**/*.e2e.test.ts"]
detection: []
relatedRules: [controller-integration-supertest, testcontainers-lifecycle]
---

# E2E는 전체 앱을 띄운다

## 왜 중요한가
E2E는 모듈 와이어링·전역 파이프/필터·가드(인증)·실제 인프라가 전부 맞물린 상태를 검증한다. 일부만 띄우면 E2E의 의미가 약해진다. 전역 `ValidationPipe`/`ExceptionFilter`를 포함한 실제 `AppModule`을 부팅하고, 인증 토큰 발급부터 보호된 엔드포인트까지의 흐름을 검증한다.

## ✅ Correct

```ts
it('auth flow: register → login → access protected', async () => {
  await request(app.getHttpServer()).post('/auth/register').send(user).expect(201);
  const { body } = await request(app.getHttpServer()).post('/auth/login').send(creds).expect(200);
  await request(app.getHttpServer())
    .get('/orders').set('Authorization', `Bearer ${body.accessToken}`).expect(200);
});
```

## 소유와 파일 관례
이 계층은 수용 레이어다 — 스캐폴드가 자동 생성하지 않고 `/dt-be-e2e`(dt-be-e2e 스킬)가 스펙 기반 시나리오로 저작하며, 사람이 원장↔테스트 리뷰로 verified를 확정한다. 파일 관례는 `test/*.e2e.test.ts`로 통일한다(nest 기본 `.e2e-spec.ts`는 레거시 — 신규 저작은 쓰지 않는다).

## 관련 규칙
- [[controller-integration-supertest]]
- [[testcontainers-lifecycle]]
