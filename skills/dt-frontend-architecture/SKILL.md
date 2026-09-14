---
name: dt-frontend-architecture
description: Use when writing or reviewing React/TypeScript code in a project that contains .dt-frontend.json — explains the 5-layer architecture (Page → Domain Component → Business Hook → Store Query/UI Store → Utils), where each kind of logic belongs, and lists the rules consumed by dt-frontend-review.
---

# dt-frontend 5-Layer Architecture

> **다른 스킬과의 관계**
> - 본 skill = **기계적 구조 룰** (어느 레이어/어떤 import — review가 자동 검출). 판단 규율(과한 추상화·수술적 변경 등)은 `dt-frontend-coding-discipline`에 별도 정리됨 — 코드 작성 시 함께 invoke 권장
> - 테스트 작성 시: `dt-frontend-testing` 도 함께 invoke (테스트 룰/전략은 거기 정리됨)
> - 신규 도메인 생성 시: `dt-frontend-scaffold` invoke
> - 작성 후 검증: `/dt-review` 또는 `dt-frontend-review` skill
>
> 본 skill은 **architecture/styling/business/vendored 룰의 단일 atlas**를 제공한다. 이 SKILL.md만 로드되어도 작성 시점에 필요한 모든 룰을 1줄 요약으로 인지할 수 있다.
>
> **레이어 계약:** 본 전역 컨벤션은 **상위 SDD 스펙/project-context 없이도 단독 적용**된다(상위는 선택적, hard-depend 금지). 상위가 있으면 `project-context.md`의 `## 프로젝트 기술/라이브러리`로 라이브러리를 **가산**(전역보다 우선)할 수 있다. 전역 choice 룰을 거스르는 예외는 사용자 합의 후에만(웨이브 B). 상세 `../../docs/skill-sdd-layering.md`.
> styling 오버라이드(`.dt-frontend.json` `overrides`)는 view-styling·no-hardcoded-design-values를 review에서 skip한다(구조 룰은 불가). **design-fidelity는 별도 override 키(`design-fidelity`)로 분리** — Tailwind 린트를 꺼도(styling) 디자인 충실도 게이트는 기본 on으로 유지된다. Figma 소스가 없는 프로젝트에서만 명시적으로 끈다.

## 레이어 개요

```
Page → Domain Component → Business Hook → Store (Query | UI) → Utils
```

| 레이어 | 위치 | 책임 | 금지 |
|---|---|---|---|
| Page | `src/pages/` | 라우트 진입점, Domain Component 조립, 비즈니스 파라미터 선언 | hook 직접 호출, fetching |
| Domain Component | `src/components/domain/` | ViewModel hook 호출, View 조립, 라우팅/Store 연결 | API 직접 호출, 시각 스타일 디테일(Tailwind 클래스/토큰) |
| View Component | `src/components/view/` | props만으로 순수 UI 렌더링 | hook 호출, store 접근 |
| UI Kit | `src/components/ui/` | shadcn/Radix 기반 벤더 UI 프리미티브 (props 순수 UI) | domain/business/store/services import (역방향 금지) |
| Business Hook | `src/business/hooks/<domain>/` | Server+Client 상태를 ViewModel로 가공, DTO→Model 변환 | JSX, DOM |
| Store Query | `src/store/queries/<domain>/` | TanStack Query 래핑, queryKey 팩토리 | ViewModel 가공, UI 상태 |
| Store UI | `src/store/stores/` | Zustand client 상태 | Server 데이터 |
| Utils | `src/utils/` | 순수 함수 | React 의존 |

## 의사결정 트리

"이 로직 어디에 둘까?"

| 로직 | 위치 |
|---|---|
| API 엔드포인트 호출 | Store Query |
| DTO → ViewModel 변환 | Business Hook |
| 페이지마다 다른 limit/sort | Page → Domain props → Business Hook params |
| 사용자가 토글하는 viewMode | UI Store (Zustand) |
| 확인/삭제 등 팝업(모달) 띄우기 | nice-modal-react (id 기반 — `useConfirm` 등 Business Hook 경유) |
| URL로 표현되는 상태 (post id) | React Router useParams |
| 좋아요처럼 공유되는 server 상태 | TanStack Query 캐시 |
| 스타일링 디테일 (Tailwind 클래스/cn) | View Component (또는 UI Kit) |
| 라우팅 (navigate) | Domain Component |

## 스타일링/도구
- **스타일 언어**: Tailwind CSS (v4, CSS-first `@theme`). SCSS 미사용.
- **컴포넌트**: shadcn/ui(코드 소유) on Radix Primitives → `src/components/ui/`.
- **테마**: semantic CSS변수 토큰(`globals.css`) + Tailwind 매핑. 다크/브랜드는 변수 세트 스왑. [토큰 브리지 규약](references/token-css-var-bridge.md)
- **클래스 병합**: `cn()`(clsx + tailwind-merge), 변형은 `cva`.
- **기본 라이브러리 세트**: Tailwind + shadcn/ui + Radix + react-hook-form+zod(폼) + @tanstack/react-table(테이블). 온디맨드: cmdk·react-day-picker·recharts·sonner·vaul·embla(필요 시만, YAGNI).
- **모달**: 관리=nice-modal-react(중앙 레지스트리), UI=shadcn Dialog(Radix). 둘은 직교 — 함께 사용.
- **패키지 매니저는 pnpm 고정** — `package.json`의 `packageManager: "pnpm@10.x"` + `pnpm-lock.yaml` 만.

## 에러 경계(Error Boundary)

5-layer 위에 "에러 경계" 책임을 더한다. 에러는 **던지고**, 선언적 ErrorBoundary가 잡는다 —
컴포넌트 본문 `if (isError) return <Fallback/>`·`navigate('/error')` 같은 명령형 처리 금지.

| 경계 | 위치 | 책임 |
|---|---|---|
| RootErrorBoundary | `App.tsx` 최상단(Router 감싸기) | 런타임/예상외/auth 최종 캐치 → 전역 에러 페이지 |
| ApiErrorBoundary | Page가 Domain Component 묶음을 감쌈 | API/도메인 에러 폴백 + 재시도(react-query reset 연계) |
| LocalErrorBoundary | 페이지 일부 블록 | 일부만 폴백(나머지 영역 정상) |

- **표준 라이브러리**: `react-error-boundary`(Sentry 비의존). react-query 연계는 `useQueryErrorResetBoundary().reset`→`onReset`, `useLocation().key`→`resetKeys`.
- **쿼리 정책**: `throwOnError`로 경계에 던질지(핵심 데이터)/로컬 처리할지(보조) 명시. 폐기된 v4 `useErrorBoundary` 옵션 금지.
- **관측 훅 포인트**: 경계 `onError`가 단일 진입점(`reportError`) — Sentry 관측 연동에서 capture를 여기 한 곳에 연결.
- **폴백 키트**: `src/components/error/`(RetryErrorFallback/LocalErrorSection/RootErrorPage) 재사용. 참조 구현: [examples/error/](examples/error/).
- 상세 분류·코드·연계: [에러 경계 계층](references/error-boundary-layering.md).
- **관측(Sentry, opt-in)**: 캡처는 경계·캐시 `onError`→`reportError` 단일 진입점. 분류→level/tag/fingerprint 매핑, PII·필터는 init 한 곳. [Sentry 관측 계층](references/sentry-observability.md).

## 클릭 요소 접근성

클릭 가능한 요소는 `<button>`/`<a>`를 쓴다. 불가피하게 비인터랙티브 요소에 onClick을 달면 role+tabIndex+키보드 핸들러를 함께 단다. 자동 강제는 jsx-a11y 린트(스캐폴드 배선)가 담당 — 리뷰 엔진 룰 아님.

## Atlas — 작성 시점에 알아야 할 모든 룰

각 룰은 1줄 요약 + 등급. 자세한 incorrect/correct는 `[상세]` 링크의 patterns 파일.
React Best Practices(vendored)도 함께 등록 — review가 자동 검출하니 작성 시에도 인지 필요.

<!-- ATLAS:START — `node plugin/scripts/regen-atlas.mjs`로 자동 생성. 직접 수정하지 마세요. -->

### Architecture
- **domain-no-direct-api** _(critical)_ — Domain Component는 axios/apiClient 직접 호출 금지, Business Hook(ViewModel) 경유 [상세](patterns/domain-no-direct-api.md)
- **fetcher-separation** _(critical)_ — Query Hook은 apiClient 직접 import 금지, services/<domain>/Fetcher 함수만 사용 [상세](patterns/fetcher-separation.md)
- **pure-view-component** _(critical)_ — View는 props만 받는 순수 컴포넌트, hook/store/router 직접 호출 금지 [상세](patterns/pure-view-component.md)
- **query-key-design** _(critical)_ — queryKey는 변경되는 모든 파라미터를 포함하는 팩토리로 정의 (캐시 분리 보장) [상세](patterns/query-key-design.md)
- **ui-kit-import-direction** _(critical)_ — components/ui(벤더 프리미티브)는 domain/business/store/services import 금지 [상세](patterns/ui-kit-import-direction.md)
- **business-logic-not-inlined** _(important)_ — ViewModel hook 파일(use*ViewModel.ts)에 순수 transform/계산 함수를 인라인 정의 금지 — <domain>Business.ts로 추출 [상세](patterns/business-logic-not-inlined.md)
- **business-logic-purity** _(important)_ — 순수 비즈니스 함수는 <domain>Business.ts에 모으고 sibling 단위 테스트 필수 [상세](patterns/business-logic-purity.md)
- **centralized-query-keys** _(important)_ — queryKey 정의는 src/store/queries/keys.ts 단일 위치, Hook 파일 내 별도 keys export 금지 [상세](patterns/centralized-query-keys.md)
- **design-fidelity** _(important)_ — 디자인 충실도: 수거 에셋은 실제 파일로 배선(플레이스홀더 `<img>`·빈 src 금지), 색은 `globals.css @theme` semantic 토큰 클래스로(임의 팔레트 `bg-blue-500` 금지). 테마 물질화 누락·매니페스트 미배선은 reviewer 크로스파일 검사 [상세](patterns/design-fidelity.md)
- **dto-vs-viewmodel** _(important)_ — View/Domain은 ViewModel(Model) 타입만 사용, DTO 타입 import 금지 [상세](patterns/dto-vs-viewmodel.md)
- **error-boundary-required** _(important)_ — Page는 자식을 최소 1개 ErrorBoundary로 감싼다 — 렌더 중 throw를 선언적으로 잡아 폴백 UI로 (react-error-boundary) [상세](patterns/error-boundary-required.md)
- **modal-management** _(important)_ — 모달은 nice-modal-react로 중앙 관리 — id 상수(src/modals/ids.ts) + 등록(src/modals/registry)만, 컴포넌트는 id로 show/resolve. 컴포넌트별 isOpen useState 분산 금지 [상세](patterns/modal-management.md)
- **no-hardcoded-design-values** _(important)_ — 생짜 hex 금지 — 토큰(CSS변수/Tailwind scale) 사용 [상세](patterns/no-hardcoded-design-values.md)
- **no-imperative-error-branch** _(important)_ — 에러를 명령형으로 처리 금지 — fetcher/컴포넌트에서 navigate('/error')·history.push('/error')로 라우팅하지 말고 ErrorBoundary에 위임 [상세](patterns/no-imperative-error-branch.md)
- **query-error-policy** _(important)_ — react-query v5 에러 정책 — 폐기된 useErrorBoundary 옵션 금지(→ throwOnError). 경계로 던질지/로컬 처리할지 명시. 404는 장애 아닌 없음(경계 제외·페이지 없음 UI), 자동 재시도 기본 없음(retry: false 캐논) [상세](patterns/query-error-policy.md)
- **sentry-single-capture** _(important)_ — Sentry 캡처는 단일 진입점(reportError)에서만 — 컴포넌트/서비스에서 captureException·captureMessage 직접 호출 금지 [상세](patterns/sentry-single-capture.md)
- **server-vs-client-state** _(important)_ — 서버 데이터는 TanStack Query, UI 상태는 Zustand — 역할 절대 섞지 않음 [상세](patterns/server-vs-client-state.md)
- **service-location** _(important)_ — axios import는 src/services/** 한정, 외부 레이어는 fetcher 경유 [상세](patterns/service-location.md)
- **view-styling** _(important)_ — Tailwind 유틸리티 + cn()로 스타일링, inline style={{}}는 동적 값 한정 [상세](patterns/view-styling.md)
- **where-does-business-logic-go** _(important)_ — Business Hook=ViewModel 가공, Store Query=fetching, View=렌더링 — 레이어 책임 위반 금지 [상세](patterns/where-does-business-logic-go.md)
- **adding-business-params** _(minor)_ — limit/sort 같은 비즈니스 파라미터는 Page에서 선언 → Business Hook param으로 전달, 내부 하드코딩 금지 [상세](patterns/adding-business-params.md)
- **fallback-escalation** _(minor)_ — 로컬 폴백은 자기 책임 밖 에러를 rethrow해 상위 경계로 위임 — 모든 에러를 같은 자리에서 삼키지 않는다 [상세](patterns/fallback-escalation.md)
- **sentry-breadcrumb-no-pii** _(minor)_ — 커스텀 브레드크럼 data에는 식별용 값(id)만 — 이름·이메일·본문 등 개인정보(PII) 금지 [상세](patterns/sentry-breadcrumb-no-pii.md)

### React Best Practices (vendored)
- **avoid-effect-for-derived-state** _(important)_ — prop/state로 즉시 계산 가능한 값은 useEffect로 동기화 X — derived state로 즉시 계산 [상세](../../rules/vendored/vercel-react-best-practices/avoid-effect-for-derived-state.md)
- **lift-state-only-as-needed** _(suggestion)_ — state는 필요한 최소 컴포넌트 트리 위치에 둠, 무분별한 lifting 금지 [상세](../../rules/vendored/vercel-react-best-practices/lift-state-only-as-needed.md)
- **use-server-components** _(suggestion)_ — React Server Component 사용 가능 환경에서는 클라이언트 컴포넌트 남용 회피 [상세](../../rules/vendored/vercel-react-best-practices/use-server-components.md)

<!-- ATLAS:END -->

## 주석 규칙

**기본: 주석 없음.** 이름이 잘 지어진 코드는 설명이 필요 없다.

### 써야 하는 경우 (WHY가 코드만으론 안 보일 때)

```ts
// optimistic update 롤백 시 서버 응답보다 로컬 상태가 먼저 반영돼야 함
mutation.onMutate(...)

// enabled 없으면 id가 0/undefined일 때 잘못된 요청이 나감
enabled: id > 0,
```

### 쓰지 않는 경우

```ts
// 좋아요 토글  ← 함수 이름이 이미 말함
function toggleLike(id: number) { ... }

// 유저 목록 쿼리  ← 읽으면 알 수 있음
const { data } = useUserListQuery();
```

| 금지 패턴 | 이유 |
|---|---|
| 라인바이라인 단계 설명 (`// 반환`, `// 실행`) | WHAT은 코드가 말함 |
| 함수/변수명 반복 (`// 유저 카드 렌더링` → `UserCard`) | 중복 |
| 태스크/PR 참조 (`// GNB 이슈 수정`) | 커밋 메시지에 속함, 코드에서 썩음 |

**한 줄 원칙: WHY가 non-obvious할 때만, WHAT은 절대 쓰지 않는다.**

## 활성화 조건

이 스킬은 `.dt-frontend.json`의 `enabledSkills`에 포함된 프로젝트에서 동작합니다. **파일이 없으면 물러나지 말고 `${CLAUDE_PLUGIN_ROOT}/docs/refs/stack-config-bootstrap.md` 절차로 만들고 계속합니다.**
