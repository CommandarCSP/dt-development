---
name: dt-be-implement
description: Use when the user wants to turn dt-bespec resource artifacts (requirements/design/tasks/api-contract in docs/specs/resources/<resource>/) into NestJS code. Reads the spec, maps api-contract.md to the Phase 1 contract + Prisma schema delta, and delegates code generation to the dt-backend-scaffold engine.
---

# dt-be-implement — spec→scaffold 다리 (Backend)

dt-bespec 산출물을 읽어 `dt-backend-scaffold` 엔진에 위임해 NestJS 코드를 생성한다. dt-be-scaffold standalone 동작은 건드리지 않는다.

## 입력
- `<specDir>` (필수): `docs/specs/resources/<resource>/` (requirements/design/tasks/api-contract 4종)

## 절차

### [1] 매핑 (api-contract.md → ScaffoldSeed)
`api-contract.md`를 읽어 다음을 만든다:
- **엔드포인트 표** → Controller 라우트 + 요청/응답 DTO 목록 → Phase 1 `contract.ts`의 DTO 인터페이스 + `XxxService`/`XxxController` 계약.
- **Prisma 스케치** → Phase 1 `prisma/schema.delta.prisma` 블록.
- **요청/응답 스키마** → DTO 필드 + class-validator 후보.
- design.md `## 시퀀스` → Service 비즈니스 로직/트랜잭션 경계.
- requirements FR + tasks 완료기준 → 계층별 테스트 기준(unit/integration/e2e).

`existingModules`(이미 있는 `src/<module>/`)를 스캔해 new-module vs extend-module을 결정.

### [2] draft 확인
헤더 `status: draft`이거나 api-contract에 `[inferred]` 마커가 있으면 AskUserQuestion 1회:
- "이 스펙은 draft이고 추론된 엔드포인트/모델 N개가 있습니다. 그대로 진행할까요? 추론 항목은 `// TODO: 확정 필요 (spec [inferred])` 주석과 함께 코드로 들어갑니다."
- options: `"진행"` / `"중단"`.
진행 시 추론 항목에 TODO 주석을 부착하고 커밋 노트에 "spec draft 기반" 표기.

### [2.5] 부분성 마커 소비 (침묵 누락 금지)
스펙(requirements/design/api-contract)의 부분성 마커를 스캔해 코드 생성에 전파한다 — 조용히 빠뜨리지 않는다:
- `<!-- skipped: IF-n (미해소) -->` (그 IF 참조 엔드포인트/요구 자리): 해당 엔드포인트를 **stub(NotImplemented) + `// TODO: 미구현 (IF-n 미해소 — 정의서 계약 미확정; /dt-devspec로 해소 후 재생성)`**로 생성하도록 controller/service dispatch 발췌에 명시.
- `<!-- partial: Figma-only IF 미수거, ... -->` (§0-b — BE가 못 읽은 IF-bearing 소스): 그 계약은 **임의 추론 금지** + 영향 엔드포인트에 TODO 표기 + 완료 보고에 "/dt-devspec 선행 필요" 강조.
- **provisional 신호:** `협의중`/`컨벤션` 기반 DTO/계약엔 `// provisional: spec 협의중 — 상향정합(T2/T3) 시 확정` 주석 + 커밋 노트([2]의 `[inferred]`(draft)와 별개 축). **동일 IF에 `skipped`(미해소→stub)와 `provisional`(잠정)은 공존하지 않음.**
- **stale 가드(거짓 TODO 방지, 필수):** 마커 발견 시 현 `docs/specs/definition.md`를 **1회 조회**해 그 IF가 **여전히 미해소/미수거면** TODO emit, **이미 해소(T5)·정식화됐으면 stale로 보고 emit 억제**. 정의서가 없으면(standalone) 마커 그대로 emit.
- 완료 보고([5])에 **미구현 마커 N건(IF 목록)** 명시.
> 마커 *능동 제거*는 leaf 재실행·dt-devspec §1(후속) 소관 — 소비 측은 stale 가드로 거짓 TODO만 억제.

### [3] 모듈 분기
- 신규 리소스 → `dt-backend-scaffold/checklist/new-module.md`.
- 기존 모듈 확장(엔드포인트/필드 추가) → `checklist/extend-module.md`.
- 리소스가 다른 리소스를 참조(FK/조인)하면 사용자에게 알리고 모듈 경계·관계를 확인.

### [3.7] 코드-레벨 플랜 생성 (plan-author, opus) — 구현 직전
스펙이 finalized면 `docs/specs/resources/<resource>/plan.md`(코드-레벨 체크박스)를 확보한다. 반환 `needsDecision` 있으면 AskUserQuestion 후 재dispatch. **사용자 플랜 승인 게이트** 후 [4]로. durable 3겹의 셋째.
- **홀리스틱(권장 — 여러 리소스):** `plan-author`(opus)를 **전 리소스를 한 번에** dispatch(`units`=리소스 목록, `stack:backend`)해 `interactions.md`의 크로스리소스(트랜잭션 경계·cascade·스키마 머지 순서)를 함께 읽고 유닛별 plan.md에 배선(`[X]`)까지 박게 한다. dt-fullstack에서 오면 이 홀리스틱 plan이 이미 있으니 **재생성 생략**.
- **단일 리소스 standalone 호출:** 그 리소스만 dispatch(interactions.md 있으면 전달). plan.md 최신이면 재생성 생략.

### [4] 위임 (Phase 1~5)
선택한 checklist를 따른다. **dispatched면 `be-builder`에 리소스 스펙 위치를 넘겨 dispatch**(워커가 api-contract/design/requirements·definition.md IF를 직접 읽음. **`interactions.md`의 BE 크로스리소스도 함께 전달** — 트랜잭션 경계·cascade), inline이면 조율자가 직접 — 둘 다 동일 절차. 빌더가 계층별로 참조하는 스펙:
- repository/dto 계층 ← api-contract의 Prisma 스케치 + 요청/응답 스키마.
- service(Phase 3) ← design 시퀀스/비즈니스 규칙.
- controller(Phase 4) ← api-contract 엔드포인트 표(method/path/status/auth).
standalone과 달리 consume이면 definition.md IF 계약을 함께 소비.

> project-context의 `## 프로젝트 기술/라이브러리` 항목은 해당 lib를 쓰는 리소스 be-builder dispatch 시 함께 전달해, 전역 기본 세트보다 우선 채택한다.

> 실행 모드(병렬/순차)·리뷰 격리는 scaffold가 따르는 `../../docs/orchestration-policy.md`를 그대로 상속한다. 다중 도메인 "범위" 질문과 별개로 실행모드 선택이 노출된다.

### [5] 게이트/완료
dt-backend-scaffold의 게이트(tsc/prisma/jest/리뷰)와 완료 처리를 그대로 따른다. Phase 5 full review는 `--stack backend`로 diff coverage 검증. + [2.5]에서 감지한 미구현 마커(skipped/partial)·provisional을 완료 보고에 "N건 미구현(IF 목록) — /dt-devspec 해소 권장"으로 명시.
- 수용 e2e 넛지: "이어서 `/dt-be-e2e`로 BE 수용 e2e 시나리오를 작성·검증할까요?" — 자동 실행하지 않고 사용자 승낙 시 dt-be-e2e로 진행. (구현 완료 리소스의 api-contract를 근거로 함)

## 활성화 조건
`.dt-backend.json` 존재, OR `/dt-be-implement <specDir>` 명시 호출.
