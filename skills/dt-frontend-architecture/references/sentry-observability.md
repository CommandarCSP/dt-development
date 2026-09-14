# Sentry 관측 계층 (보고 모델)

선언적 에러 처리 위에 Sentry 계측을 얹는 SOT. 캡처는 두 촉킹포인트로만 모으고,
분류를 level/tag/fingerprint에 매핑하며, PII·필터는 init 한 곳에 둔다.
관련 룰: [[sentry-single-capture]] · [[sentry-breadcrumb-no-pii]] · [[query-error-policy]].
전체 설명(예시 포함): Confluence "dt-frontend Sentry 에러 관측" 문서 참고.

## 1. 두 촉킹포인트 → 단일 진입점
| 촉킹포인트 | 잡는 것 |
|---|---|
| ErrorBoundary `onError` | 렌더 오류 + 위임(rethrow) 오류 |
| QueryCache/MutationCache `onError` | 경계에 안 닿는 조회·변경 오류 |

둘 다 `reportError`(참조 구현 `examples/error/reportError.ts`)로 합류. 산발 `captureException` 금지([[sentry-single-capture]]).

## 2. 분류 → Sentry 매핑
| kind | level | tag type | fingerprint |
|---|---|---|---|
| network | warning | network | 기본(스택) |
| notFound | — (캡처 제외) | — | — |
| api | 4xx=warning·5xx=error | api + status | `[method, status, route템플릿]` |
| auth | info | auth | — |
| runtime | error | runtime | 기본(스택) |

`notFound`(HTTP 404)는 장애가 아니라 **없음**(기대 오류)이라 `reportError`에서 캡처 제외(early return)한다 — `beforeSend`의 404 필터와 정합. 페이지가 없음 UI로 처리(문구는 페이지 소유).

fingerprint는 원본 URL이 아니라 **경로 템플릿**(`/users/:id`). id별 이슈 쪼개짐·PII 노출 방지.

## 3. 브레드크럼
자동 수집(fetch/네비게이션/콘솔/클릭)을 신뢰하고, 커스텀은 얇게 — store 쿼리 의미 + domain 사용자 의도만.
`data`에는 식별용 값만([[sentry-breadcrumb-no-pii]]).

## 4. 필터링 (init 한 곳)
- PII: `sendDefaultPii=false` + `beforeBreadcrumb`/`beforeSend` 마스킹.
- 기대 오류(예: 401·404 등 이미 처리되는 오류)는 `beforeSend`에서 `null` 반환.
- 샘플링: 운영 낮게(0.05)·개발 1.0.
- 고급 샘플링: 경로별 상향/하향이 필요하면 `tracesSampler`(함수)로 대체 — 크리티컬 경로 상향, 잡음 경로 0. `tracesSampleRate`와 함께 쓰지 않는다.

## 5. 도입 (opt-in)
전역 강제 아님. 도입은 `dt-frontend-scaffold` new-project의 **opt-in "관측(Sentry)" 단계**가 배선한다(키트 복사 + init/queryClient/경계 + `@sentry/vite-plugin` 소스맵). 채택 프로젝트는 `.dt-frontend.json`에 `observability: { provider: "sentry" }`로 기록하고, 환경변수 `VITE_SENTRY_DSN`(런타임)·`SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`(빌드 소스맵)만 채우면 된다. 책임소재 자동화(CODEOWNERS·SCM suspect commits)와 Sentry MCP triage 문서화는 별도 후속.
