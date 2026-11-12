# Checklist: New Project

사용자 요청 예: "dt-frontend 아키텍처로 새 React 프로젝트 만들어줘. 게시판 1차."

> **Note**: new-project does not use worktree isolation — you are working in the target directory directly since there is no existing repo to protect. Worktree isolation applies to new-domain and extend-domain workflows.

## 사전 조건
- 현재 디렉토리가 빈 디렉토리 또는 사용자가 명시한 신규 경로
- 사용자가 프로젝트 이름과 첫 도메인 명확히 함

## 단계

### 1. 프로젝트 스캐폴드 (공식 CLI)

보일러플레이트 템플릿은 쓰지 않는다. 공식 도구로 스캐폴드한 뒤 컨벤션을 적용한다.

```bash
npm create vite@latest <project-root> -- --template react-ts
cd <project-root>
```

그다음 `dt-frontend-architecture` 컨벤션에 맞게 설정한다(상세는 해당 Atlas 참조):
- **스타일**: Tailwind CSS v4(`@tailwindcss/vite`) + shadcn/ui(Radix) + `src/styles/globals.css`(CSS변수 토큰) + `src/lib/utils.ts`(`cn`). `@` alias를 `vite.config.ts`·`tsconfig`에 추가.
- **테스트**: Vitest + Testing Library + MSW, Playwright(e2e). `vite.config.ts`/`vitest.config.ts` 분리.
- **린트(a11y)**: `eslint-plugin-jsx-a11y`를 배선한다. 클릭 핸들러가 달린 비인터랙티브 요소(`<div onClick>` 등 — 키보드로 접근 불가)를 lint가 작성 시점에 자동 차단한다(도그푸딩 발견 — 리뷰 엔진 룰이 아니라 스캐폴드가 켜는 린트가 담당).
  ```bash
  pnpm add -D eslint-plugin-jsx-a11y
  ```
  flat config(`eslint.config.js`)에 recommended를 추가:
  ```js
  import jsxA11y from 'eslint-plugin-jsx-a11y';

  export default [
    // ...기존 config
    jsxA11y.flatConfigs.recommended,
  ];
  ```
- **`.dt-frontend.json`** 생성(루트): `paths`, `coverage.mode`, `enabledSkills` 등.
- **디자인 토큰 물질화(테마 충실도)**: `docs/project-context.md`에 `## 디자인 토큰`이 채워져 있으면(dt-spec이 Figma 분석으로 누적) `globals.css`의 `@theme`를 토큰에서 생성한다:
  ```bash
  node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/materialize-tokens.mjs" --project .
  ```
  스크립트는 `docs/project-context.md ## 디자인 토큰`을 파싱해 `src/styles/globals.css`의 마커 블록(`/* dt:tokens:start */ … /* dt:tokens:end */`) 안에만 `@theme`(색/타이포/간격/radius)을 생성한다 — 마커 밖 사용자 편집은 보존. 토큰이 아직 없으면 빈 `@theme`를 유지하고 넘어간다. 매핑 규약은 `dt-frontend-architecture/references/token-css-var-bridge.md`. 이후 컴포넌트는 이 semantic 토큰 클래스만 쓴다(임의 팔레트·raw 값 금지).

### 2. 의존성 설치

```bash
pnpm install
npx playwright install chromium
```

### 수용 e2e(accept) 배선

`playwright.config.ts`를 생성한다(MSW 격리 기본, 실연동 스위치는 env):

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: { baseURL: 'http://localhost:5173' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // 기본은 MSW 격리. 실연동은 E2E_LIVE=1로 VITE_USE_MOCKS를 끈다.
    command: process.env.E2E_LIVE ? 'VITE_USE_MOCKS=false pnpm dev' : 'VITE_USE_MOCKS=true pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: false, // 실연동 dev 서버 재사용 방지
  },
});
```

`package.json` 스크립트:

```json
"test:accept": "playwright test",
"test:accept:live": "E2E_LIVE=1 playwright test"
```

이 env 스위치가 설계의 MSW/실연동(msw/live) 스위치를 구현한다. headed 검증은 `pnpm test:accept --headed`.

### 3. 첫 도메인 처리

### 실행 모드 선택 (정책 원칙 1)
Phase 2 병렬 dispatch 전, 작업 단위 의존성을 보고 `orchestration-policy.md` 원칙 1의 AskUserQuestion으로 병렬/순차를 1회 확인한다(기본 병렬). 순차 선택 시 원칙 2대로 단위를 직렬 dispatch한다.

첫 도메인은 [new-domain.md](./new-domain.md) 흐름으로 5-layer를 정식 위치(`src/types`·`src/store/queries`·`src/business/hooks`·`src/components`·`src/pages`)에 생성한다. (예시 보일러플레이트 도메인은 더 이상 제공하지 않음 — 스캐폴드 직후 빈 `src/`에서 시작.)

### 4. 관측(Sentry) — opt-in (도입 시에만)

`AskUserQuestion`으로 "이 프로젝트에 Sentry 관측을 도입할까요?"를 묻는다(기본: 아니오).
"아니오"면 이 단계를 건너뛴다. "예"일 때만 아래를 수행한다(도입 프로젝트만 배선).

**4-1. 의존성**
```bash
pnpm add @sentry/react react-error-boundary
pnpm add -D @sentry/vite-plugin
```

**4-2. 에러 키트 복사** — canonical `dt-frontend-architecture/examples/error/`가 유일 원본(SSOT).
아래 12파일을 `src/components/error/`로 **내용 수정 없이** 복사한다:
`classifyError.ts` · `httpMeta.ts` · `reportError.ts` · `sentry.config.ts` · `queryClient.ts` · `breadcrumbs.ts` · `RootErrorBoundary.tsx` · `ApiErrorBoundary.tsx` · `LocalErrorBoundary.tsx` · `RootErrorPage.tsx` · `RetryErrorFallback.tsx` · `LocalErrorSection.tsx`
(키트는 `@/components/ui/button`·react-error-boundary·@tanstack/react-query·react-router-dom을 쓴다 — 모두 스캐폴드 기본 스택에 있음.)

**4-3. 엔트리 배선**
- `main.tsx` 최상단에서 초기화:
  ```ts
  import { initSentry } from './components/error/sentry.config';
  initSentry(); // VITE_SENTRY_DSN 있으면 활성, 없으면 no-op
  ```
- `App.tsx`에서 기본 QueryClient 대신 kit `queryClient` 사용 + 트리를 `RootErrorBoundary`로 감쌈:
  ```ts
  import { queryClient } from './components/error/queryClient';
  import { RootErrorBoundary } from './components/error/RootErrorBoundary';

  // <RootErrorBoundary>
  //   <QueryClientProvider client={queryClient}> … </QueryClientProvider>
  // </RootErrorBoundary>
  ```
  (직접 `new QueryClient()`를 만들었다면 제거하고 kit `queryClient`로 대체 — 캡처 촉킹포인트가 배선된 인스턴스다.)

**4-4. 소스맵 업로드 (`@sentry/vite-plugin`)** — `vite.config.ts`에 추가. 플러그인은 **배열 마지막**, 토큰 없으면 no-op.
```ts
import { sentryVitePlugin } from '@sentry/vite-plugin';
// defineConfig에 build.sourcemap: true 추가
// plugins 배열 마지막에:
sentryVitePlugin({
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disable: !process.env.SENTRY_AUTH_TOKEN,       // 토큰 없으면 skip(로컬 빌드 안전)
  sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] }, // 업로드 후 원본 삭제
}),
```
실제 업로드(CI에 토큰 설정) 시 `pnpm approve-builds @sentry/cli` 필요할 수 있음(@sentry/cli 빌드 스크립트).

**4-5. 환경변수 (`.env.example`)** — 도입 프로젝트가 채우는 전부:
```bash
# 런타임 (클라이언트 노출 OK) — Sentry Settings → Client Keys(DSN)
VITE_SENTRY_DSN=
# 빌드/CI 전용 (비밀 — VITE_ 접두사·커밋 금지). 없으면 소스맵 업로드 skip.
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
```
`.env.local`은 `*.local`로 이미 무시되지만, `.gitignore`에 `.env`/`.env.*`(단 `!.env.example`) 규칙을 확인·추가한다.

**4-6. 채택 기록** — `.dt-frontend.json`에 추가:
```json
"observability": { "provider": "sentry" }
```

**4-7. 검증** — `npx tsc --noEmit` 통과 + `/dt-review`에서 sentry 룰(`sentry-single-capture` 등) 위반 0. DSN 없이 `pnpm dev`가 정상 기동(Sentry no-op)하는지 확인.

### 5. 검증

```bash
npx tsc --noEmit
pnpm lint:style
pnpm test --run
pnpm dev   # 브라우저에서 확인
```

### 6. 초기 commit

```bash
git init
git add .
git commit -m "feat: bootstrap dt-frontend project (<project-name>)"
```

### 7. 다음 단계

다음 도메인 추가는 [new-domain.md](./new-domain.md) 흐름.
