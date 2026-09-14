---
name: dt-spec-collect-project-context
user-invocable: false
description: Use when dt-spec needs the project's overview, constraints, domain glossary, and tech stack. Reads `package.json` for tech stack (auto-sync), reads existing `docs/project-context.md` if present, and asks the user for missing sections. Returns a project context object reused across all subsequent skills in the session.
---

# CollectProjectContext

프로젝트 전반 컨텍스트를 수집/조회하고 `docs/project-context.md`를 관리한다. dt-spec 세션 내 1회만 실행 (이후 메모리 객체 재사용).

## 책임 (design doc 5-2)

- 프로젝트 개요/특성/제약사항/도메인 용어 수집 (askQuestion)
- `package.json` 파싱 → 기술 스택 자동 동기화 (design doc 5-4, 5-7)
- `docs/project-context.md` 저장/조회 (templates/project-context.md.tmpl 사용)

## 입력

- (최초) 사용자 askQuestion 답변 + 프로젝트 루트 `package.json` + `templates/project-context.md.tmpl`
- (재실행) 기존 `docs/project-context.md` + 변경 감지된 `package.json`

## 출력

```
{
  overview: string,
  techStack: { framework, buildTool, stateManagement, serverState, styling, auth, testing, packageManager, nodeVersion },
  designTokens: {                    // dt-spec이 페이지 분석으로 점진 누적 (이 스킬은 저장소 책임만 — 추출/merge X)
    colors: { [name: string]: string },
    typography: { [name: string]: { fontFamily, fontSize, fontWeight, lineHeight? } },
    spacing: number[],
    radius: number[]
  },
  constraints: string,
  domainGlossary: string,
  projectLibraries: string             // 전역 기본 세트 외 이 프로젝트가 의도적으로 채택한 lib/기술 (권위 있는 지시). 비어도 됨('').
}
```

+ `docs/project-context.md` 파일 갱신.

> **분류 책임**: `parsePackageJson.mjs`는 raw deps + packageManager + nodeVersion만 반환 (Task 6). 카테고리 분류(framework/buildTool/...)는 이 스킬에서 Claude가 의존성 리스트를 읽고 수행한다. 알 수 없는 라이브러리(astro/remix/qwik/사내 wrapper 등)도 LLM 추론으로 분류 가능.

> **디자인 토큰 책임 분리**: 이 스킬은 `designTokens`의 **저장소**(파일 읽기/쓰기/포맷) 역할만 한다. 실제 추출은 `AnalyzeFigmaFrame`(Figma `get_design_context`/`get_variable_defs`)이, 페이지 분석 결과를 토큰 섹션에 merge하는 책임은 `GeneratePageDevSpec` [3.5]가 진다 (diff-then-confirm — design doc 5-7 정책 적용).

## askQuestion 작성 원칙

이 스킬의 모든 AskUserQuestion은 ① 왜 묻는지 + 용도 ② 답이 `project-context.md`의 어느 섹션·후속 산출물(design.md 아키텍처 등)에 반영되는지 ③ 예시를 담는다. **짧은 질문 금지.** 전체 규칙은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/askquestion-principle.md`를 Read해 적용한다.

## 절차

### Step 1: 기존 파일 확인

`docs/project-context.md` 존재 여부 확인.
- 존재 → Step 2-A
- 부재 → Step 2-B

### Step 2-A: 재실행 흐름

1. `docs/project-context.md` 읽기.
2. `scripts/projectContextSync.mjs#parseMetaHeader`로 메타 추출.
3. `package.json` mtime 확인 (`fs.stat`).
4. `needsSync({ currentPkgMtime, storedPkgMtime })` 호출.
   - `true` → 강제 동기화 (Step 3 진행)
   - `false` → 누락된 askQuestion 섹션(개요/제약사항/도메인 용어)이 있는지 검사:
     - 있음 → askQuestion으로 보강 → Step 4
     - 없음 → **기존 파일을 파싱해 메모리 객체 복원** 후 반환 (종료). 복원 방법은 Step 2-A.5 참조.
5. **메모리 객체 복원 (needsSync=false + 누락 없음 분기에서만 사용)**:
   - `## 개요` 다음 줄 → `overview`
   - `## 제약사항` 다음 줄 → `constraints`
   - `## 도메인 용어` 다음 줄 → `domainGlossary` ('(없음)' 이면 빈 문자열)
   - `## 기술 스택` 섹션의 9개 bullet 라인 → 각 카테고리값 추출 (`- Framework: react (+ ...)` → `framework: 'react'` — primary value만, parenthesis값은 제거). '(미식별)' 이면 `null`.
   - `## 디자인 토큰` 섹션 → `designTokens` 객체 파싱 (colors/typography/spacing/radius 하위 구조 — 형식은 Step 4의 "designTokens 직렬화 형식" 참조). 섹션이 비어있거나 `(없음 ...)` 안내문만 있으면 `{ colors: {}, typography: {}, spacing: [], radius: [] }`.
   - `## 프로젝트 기술/라이브러리` 다음 블록 → `projectLibraries` (괄호 안내문 줄은 제외하고 본문만; `(없음)`/빈 줄이면 `''`). **이 섹션은 package.json 자동 동기화 대상이 아니다 — 사용자가 직접 적은 권위 지시이므로 항상 원문 보존**.
   - 결과를 `{ overview, techStack, designTokens, constraints, domainGlossary, projectLibraries }` 객체로 반환.

### Step 2-B: 최초 흐름

1. **Step 3 substep 1~3 먼저 실행** (package.json 파싱 + Claude 분류 → techStack 결정). **substep 4 (편집 흔적 감지)는 SKIP** — 최초 작성이므로 비교 대상이 없다.
2. AskUserQuestion으로 다음을 수집한다. 셋 다 자유 입력형이므로 옵션을 강제하지 말고 **질문에 용도·반영처·예시**를 명시한다 (원칙 참조). 모두 `docs/project-context.md`에 기록되고 이후 모든 페이지 spec의 맥락이 된다.
   - 개요: "이 프로젝트를 한 줄로 설명해주세요. project-context.md 개요가 되고 이후 모든 페이지 spec의 맥락으로 쓰입니다. (예: 'PROP 서비스 웹 프론트엔드 — 파일 관리 포함')"
   - 제약사항: "프로젝트 전반의 제약사항이 있나요? requirements.md 비기능 요구·design.md 판단에 반영됩니다. 없으면 'skip'. (예: 모바일 우선, 다국어, 결제 PG 연동, 한국어 사용자)"
   - 도메인 용어: "프로젝트 고유 도메인 용어가 있나요? spec 문서 전반의 워딩 일관성에 쓰입니다. 없으면 'skip'. (예: 정산=settlement, 거래내역=transaction)"
   - (techStack은 묻지 않음 — package.json + 본 스킬에서 분류)
3. 사용자가 'skip' 또는 빈 답변 → 해당 placeholder는 `(없음)`으로 채움.
4. `designTokens`는 빈 객체로 초기화 (`{ colors: {}, typography: {}, spacing: [], radius: [] }`). 페이지 분석에서 추출된 토큰은 `GeneratePageDevSpec` [3.5]가 이후 merge한다.
5. `projectLibraries`는 빈 문자열(`''`)로 초기화. **이 섹션 전용 질문은 만들지 않는다** (선택적, 비어도 됨). 사용자가 자발적으로 적거나 dt-spec 입력(문서/요구사항)에 전역 세트 외 채택 lib가 명시되면 그때 채운다.
6. Step 4 진행.

### Step 3: package.json 파싱 + 기술 스택 분류

1. `import { parsePackageJson } from '<plugin>/scripts/parsePackageJson.mjs'`.
2. `package.json` 읽고 파싱 → `{ dependencies, packageManager, nodeVersion }` raw 객체.
3. **Claude가 `dependencies` 객체(키 = 패키지명, 값 = 버전)를 읽고** 다음 9개 카테고리로 분류해 `techStack` 객체를 만든다:

| 카테고리 | 분류 가이드 (Claude가 의존성 이름으로 판단) |
|---|---|
| `framework` | UI 프레임워크. 예: `react` / `vue` / `svelte` / `solid-js` / `astro` / `qwik` / `remix` / `next` 등 |
| `buildTool` | 빌드 도구. 예: `vite` / `webpack` / `parcel` / `esbuild` / `turbopack`. Next.js처럼 framework가 build를 포함하면 동일 값 |
| `stateManagement` | 클라이언트 상태. 예: `zustand` / `@reduxjs/toolkit` / `mobx` / `jotai` / `recoil` / `valtio` 등 |
| `serverState` | 서버 상태. 예: `@tanstack/react-query` / `@tanstack/vue-query` / `swr` / `urql` / `apollo-client` 등 |
| `styling` | 스타일링. 예: `tailwindcss` / `sass` / `styled-components` / `@emotion/react` / `vanilla-extract` / `panda-css` 등 |
| `auth` | 인증/세션. 예: `@supabase/supabase-js` / `firebase` / `next-auth` / `@clerk/nextjs` / `@auth0/auth0-react` 등 |
| `testing` | 테스트. 예: `vitest` / `jest` / `@playwright/test` / `cypress` / `mocha` 등 |
| `packageManager` | `pkg.packageManager` 그대로 (예: `pnpm@10.0.0`). null이면 "(미식별)" |
| `nodeVersion` | `pkg.engines.node` 그대로 (예: `>=20`). null이면 "(미식별)" |

분류 규칙:
- 가이드 표는 **힌트일 뿐 완전한 목록이 아니다**. 표에 없는 라이브러리도 이름/생태계 지식으로 추론 분류한다 (예: 사내 `@company/ui-kit`이 컴포넌트 라이브러리면 `styling` 영역에 부연 표기).
- 한 카테고리에 여러 후보가 있으면 가장 메인으로 쓰이는 것 1개를 고르고 나머지는 부연 (예: `tailwindcss + sass` → `styling: tailwindcss (+ sass for legacy)`).
- 카테고리에 해당하는 의존성이 없으면 `null`.
- **불확실하면 askQuestion** (원칙 적용): `question`에 어느 라이브러리가 왜 모호한지 + 분류 결과가 project-context.md 기술 스택과 design.md 아키텍처에 반영됨을 명시. 예 — `header` "스택 분류", `question` "`@company/ui-kit`의 역할이 모호합니다 (사내 패키지라 생태계 지식으로 판단 불가). 어느 카테고리인가요? project-context.md 기술 스택에 기록됩니다." / options: label `"스타일링/컴포넌트"`(description `"UI 컴포넌트·디자인 시스템 → styling 영역에 표기"`) / label `"상태 관리"`(description `"클라이언트/서버 상태 라이브러리"`) / label `"기타·해당 없음"`(description `"위 카테고리 아님 — 직접 설명"`)

4. 사용자가 직접 편집한 흔적이 있나? **(Step 2-A 분기에서만 수행. Step 2-B 최초 흐름은 skip — 비교 대상 없음.)**

   비교는 **정규화 후** 수행 (false positive 방지):
   - 각 bullet 라인에서 primary value만 추출 — `- Framework: react (+ legacy 표기)` → `react`
   - parenthesis 부연(`(+ ...)`), 트레일링 공백 무시.
   - 9개 카테고리 각각 `{category}: {primaryValue}` 단위로 비교.
   - 둘 다 `(미식별)` 이면 같음.

   판정:
   - **편집 흔적 있음** → diff 표시 + 사용자 confirm 후 갱신.
   - **편집 흔적 없음** → 강제 갱신 (MVP 정책, design doc 5-7 "package.json 출처 섹션").

### Step 4: 파일 작성

1. `templates/project-context.md.tmpl` 로드.
2. 모든 `{{PLACEHOLDER}}` 치환:
   - `{{LAST_SYNCED_AT}}` = 현재 ISO 8601 UTC
   - `{{PACKAGE_JSON_MTIME}}` = `fs.stat(package.json).mtime`.toISOString()
   - `{{OVERVIEW}}`, `{{CONSTRAINTS}}`, `{{DOMAIN_GLOSSARY}}` = 사용자 답변
   - `{{FRAMEWORK}}` ~ `{{NODE_VERSION}}` = Step 3에서 분류한 techStack 객체 (null이면 "(미식별)")
   - `{{DESIGN_TOKENS}}` = `designTokens` 직렬화 (아래 형식). 최초 실행 + 토큰 비어있음 → `(없음 — 페이지 분석 시 누적됨)`로 표기.
   - `{{PROJECT_LIBRARIES}}` = `projectLibraries` 원문 그대로. 비어있으면 `(없음)`. **package.json 자동 동기화 대상이 아니므로 재실행 시에도 기존 사용자 작성 내용을 절대 덮어쓰지 않는다** (Step 2-A.5에서 복원한 값 보존).
3. `docs/project-context.md`에 저장 (디렉토리 없으면 생성).
4. 메모리 객체로 반환.

**designTokens 직렬화 형식** (Step 2-A.5 파싱과 호환되도록 정해진 모양 유지):

```
### 색
- primary: #5659FF
- text: #49454F

### 타이포그래피
- Title: Pretendard SemiBold 16px
- Body: Pretendard Regular 15px

### 간격
- 4, 8, 12, 16, 24

### radius
- 4, 8
```

빈 sub-섹션은 생략한다 (예: `radius`가 비었으면 `### radius` 줄 자체를 출력하지 않음). 전체가 비었으면 위 4-line 안내문 하나로 대체.

## 갱신 정책 cross-reference

상세는 design doc 5-7:
- askQuestion 출처 섹션 (개요/제약사항/도메인 용어) → 사용자 편집 우선 (절대 자동 덮어쓰기 X)
- package.json 출처 섹션 (기술 스택) → 변경 감지 시 강제 동기화 (MVP)
- figma 출처 섹션 (디자인 토큰) → 페이지 분석마다 누적, 변화 발생 시 diff-then-confirm. **갱신 수행 주체는 GeneratePageDevSpec [3.5]** (이 스킬은 직렬화·파싱만 담당)

## 호출 위치

`GeneratePageDevSpec`이 워크플로 [2]에서 호출. 다른 스킬은 직접 호출 X — `projectContext` 객체를 인자로 받는다.
