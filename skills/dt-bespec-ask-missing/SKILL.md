---
name: dt-bespec-ask-missing
user-invocable: false
description: Use within dt-bespec to resolve source conflicts/duplicates and fill missing endpoint details (method, path, request/response schema, status codes, authz) via EARS-formatted askQuestion before writing backend spec artifacts.
---

# dt-bespec Ask Missing

머지 결과의 충돌/중복을 해소하고, 누락된 API 상세를 EARS 형식 질문으로 채운다. (FE ask-missing 대응)

## 입력
- `_conflicts` (필드 충돌), `_possibleDuplicates` (교차 소스 동일 엔드포인트 후보)
- 각 소스의 partial ExtractionResult
- (선택) OpenAPI를 사전 매칭에 사용

## Step 0: 충돌·중복 해소
- 필드 충돌: **소스 우선순위 사다리(generate-spec `[7-0]`)로 먼저 자동 해소** — 차원별 권위(와이어 포맷=런타임 계약/OpenAPI, 타입=ERD, 규칙=문서)로 승자 선택 → `source: 'precedence-resolved'`. 예: 문서 `authorId` vs FE 런타임 `userId` → `userId`. 사다리로 못 가르면(권위 소스 침묵·동급) 사용자가 소스 선택/직접 입력 → `source: 'user-resolved'`.
- 중복 엔드포인트(method+path 동일): 같은 것/다른 것 confirm → 머지.

## Step 1~5: 명세 보강
1. AI 추론 엔드포인트 후보 confirm/edit/remove (`ai-confirmed`/`ai-edited`).
2. 모호 후보 명확화(`confidence: ambiguous`).
3. 누락 카테고리 체크리스트: 인증/인가, 페이지네이션, 정렬/필터, 멱등성, rate-limit, 감사 로그, 문자열 입력 필드 상·하한(필드마다 최대 길이 + 400 조건 — 침묵 시 반드시 질문) <!-- from: audit 2026-07-24-spec SB-4/SB-9 -->.
   - **인증 발급 트리거**: "이 백엔드가 토큰을 발급하나?" 확인. Y → auth 리소스(register/login/refresh)가 필요하다는 신호로 표시. N → 외부 발급 가정(토큰 검증만, 현 동작). 단 원천(OpenAPI security scheme·ERD `passwordHash`/refresh/role)이 인증을 명시하면 **그것을 우선**하고 묻지 않는다(소스-퍼스트).
   - **토글/멱등 트리거**: 켜고/끄는 관계(좋아요·팔로우·북마크 등) 후보가 보이면 "이건 멱등 토글인가?" 확인. Y → `templates-backend/toggle-recipe.md` 캐논 신호로 표시(복합 PK·`upsert`/`deleteMany` 멱등·`count`/`byMe` 집계·actor=토큰 sub). 원천이 이미 토글 계약(`POST`/`DELETE` 204 + `count`/`byMe`)을 명시하면 묻지 않고 따른다.
4. EARS 형식 질문으로 method/endpoint/request·response schema/status code 채움.
   - Unwanted(error): 검증실패(400)/미존재(404)/충돌(409)/권한(401·403) 분기.
5. 값 검증: path 형식, method enum, status code 유효성, JSON schema 형식.

## 출력
```
resolvedRequirements: [{ id, raw: {trigger, condition, response}, sourceLabel }]
resolvedEndpoints: [{ method, path, auth, requestSchema, responseSchema, statusCodes, source }]
resolvedDataModel: { entities: [...] }     // Prisma 스케치용
status: 'finalized' | 'draft'              // 미해소 슬롯 있으면 draft
```

## 원칙
- 맥락에서 못 채우는 슬롯은 지어내지 말고 `{확인 필요}`로 두고 질문.
- 질문은 배경 + 영향 + 선택지 형태(빈 라벨 금지).
