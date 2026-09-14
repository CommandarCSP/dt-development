# 캐논 토글/멱등 레시피 (켜고/끄는 관계 기본값)

> dt-bespec `[7-4]` 토글/멱등 관계 도출이 **감지 신호(POST/DELETE 204 쌍 + count/byMe) 또는 토글 트리거=Y**일 때 instantiate하는 캐논.
> 좋아요(post/comment)·팔로우·북마크·구독·반응처럼 "actor가 target에 대해 한 번만 켜고/끌 수 있는" M:N 관계의 **"Case 2 기본값"**.
> 원천이 다른 형태(카운트 없는 단순 관계, 멱등 아님 등)를 명시하면 그것을 우선(소스-퍼스트).
> instantiate 결과는 일반 리소스와 동일하게 생성된다 — 엔진은 토글을 특수 취급하지 않는다.

## 캐논 패러다임

| 관심사 | 구현 |
|---|---|
| 신원(actor) | **항상 토큰 sub**(`@CurrentUser().id`). 바디/쿼리로 actor 받지 않음(스푸핑 방지) |
| 추가 | `upsert`(복합키 `where` + `create` + `update: {}`) — 멱등(두 번 눌러도 1건, unique 위반 없음) |
| 취소 | `deleteMany`(actor+target `where`) — 멱등(없어도 에러 없음) |
| 카운트 | 부모 read 모델의 `<rel>Count` = `_count.<rel>` (집계 select, **N+1 금지**) |
| 본인 여부 | `<rel>edByMe` = 같은 select의 `<rel>: { where: { actorId: viewer } }` 존재 여부 |
| 타겟 검증 | 미존재 target → `404` (멱등이라도 대상 없음은 거부) |

## 엔드포인트 (→ api-contract.md)

| Method | Path | Auth | Request | Response | Status |
|---|---|---|---|---|---|
| POST | /&lt;target&gt;/:id/&lt;rel&gt; | jwt | — | — | 204, 404 |
| DELETE | /&lt;target&gt;/:id/&lt;rel&gt; | jwt | — | — | 204, 404 |

- 응답 바디 없음(204). **카운트/상태는 부모 리소스 조회 응답에 실린다**(별도 toggle 조회 API 만들지 않음).
- self 관계(팔로우 등)에서 actor == target이면 `400`.

## Prisma delta (→ api-contract.md `{{PRISMA_SKETCH}}`)

```prisma
model PostLike {                 // 예: PostLike / CommentLike / Follow
  actorId  Int                   // userId / followerId
  targetId Int                   // postId / followingId
  actor    User @relation("...actor", fields: [actorId],  references: [id], onDelete: Cascade)
  target   Post @relation(fields: [targetId], references: [id], onDelete: Cascade)
  @@id([actorId, targetId])      // 복합 PK = 구조적 멱등(중복 insert 불가)
  @@index([targetId])            // 카운트/목록 조회 경로
}
```
- 부모(`<target>`) 모델에 역관계(`<rel> <Rel>[]`)를 추가해 `_count`·`byMe` 집계가 가능하게 한다.

## 요구사항 골격 (→ requirements.md, EARS)

- `[Event-driven(request)]` WHEN an authenticated client sends `POST /<target>/:id/<rel>`, THE SYSTEM SHALL ensure the relation exists (idempotent) and respond `204`.
- `[Event-driven(request)]` WHEN an authenticated client sends `DELETE /<target>/:id/<rel>`, THE SYSTEM SHALL ensure the relation is absent (idempotent) and respond `204`.
- `[Ubiquitous]` THE SYSTEM SHALL compute `<rel>Count` and `<rel>edByMe` on the parent resource response from aggregates (no N+1 per item).
- `[Unwanted(error)]` IF the target does not exist, THEN THE SYSTEM SHALL respond `404`.
- `[Unwanted(error)]` IF actor == target on a self-relation, THEN THE SYSTEM SHALL respond `400`.

## 설계 메모 (→ design.md 시퀀스)

- **레이어 배치**: actor는 Controller에서 `@CurrentUser().id`로만 주입(절대 바디 금지). Repository가 join 테이블 유일 Prisma 호출자. 멱등은 `upsert`/`deleteMany`로 DB 레벨 보장.
- **집계 위치**: `count`/`byMe`는 **부모 리소스 repository의 select**(`_count` + viewer 조건 관계)에서 한 번에 — 토글 리소스가 따로 내려주지 않는다.
- **인가는 별개**: actor 신원(authN)만 본 레시피 범위. 누가 토글할 수 있는지의 역할/소유권 판단은 각 리소스 service 책임.

## 비범위 (YAGNI)

다중 반응 종류(이모지 N종 → `type` 컬럼 확장 경로만), 좋아요 이력/타임라인, 토글 시 알림 발행(이벤트 훅은 별도).
