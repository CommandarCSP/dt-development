---
description: Build SDD-format spec documents (requirements.md/design.md/tasks.md/layout-skeleton.md) for a page from multiple sources (Figma nodes, Markdown, PDF, web docs). Outputs to docs/specs/pages/<page>/.
argument-hint: '<locator>[@role] [<locator>[@role] ...] [--source <locator>[@role]] [--api-doc <path>] [--design-system-node-id <id>] [--only requirements|design|tasks|layout-skeleton]'
allowed-tools: Read, Write, Edit, Bash, Task, AskUserQuestion, WebFetch, mcp__claude_ai_Notion__notion-fetch, mcp__claude_ai_Atlassian__fetch, mcp__claude_ai_Atlassian__getConfluencePage
---

Run dt-spec to generate SDD spec documents for a page.

Raw arguments: `$ARGUMENTS`

## 인자

- `<locator>[@role]` (1개 이상 필수): 소스 locator를 나열한다. locator 종류:
  - Figma 노드 id (예: `1:234@design`, `2:456@wireframe`) — `@role` 미지정 시 역할 질문
  - Figma URL (`figma.com/design/<fileKey>/...`)
  - 파일 경로 (예: `./docs/req/spec.md`, `./docs/spec.pdf`)
  - URL (Notion `notion.so/...` / Confluence `*.atlassian.net/...` / 일반 `https://...`)
- `--source <locator>[@role]` (옵셔널): positional과 동일 의미. 자동감지가 틀릴 때 `type:locator` prefix 사용 (예: `--source markdown:./weird:name.txt`)
- `--api-doc <path>` (옵셔널): OpenAPI 3.x (`.yaml`/`.json`) 또는 Markdown API 문서 경로 — 사전 매칭에만 사용
- `--design-system-node-id <id>` (옵셔널): Figma 디자인 시스템 node id — 디자인 토큰/컴포넌트 매칭에 사용
- `--only requirements|design|tasks|layout-skeleton` (옵셔널): 재실행 시 일부 산출물만 갱신. 지정 파일만 재생성하며 다른 파일(헤더 포함)은 일절 건드리지 않음 — 헤더 버전 혼합 허용 (design doc(2026-06-01) §8-4)

## 흐름

1. 소스 해석: locator 파싱 + 타입 자동감지 → 콘텐츠 로드 (MD→Read / PDF→Read(pages) / Notion→MCP / Confluence→MCP / URL→WebFetch / Figma→노드참조)
2. Pre-flight Check (Figma 소스가 있을 때만 — Figma MCP 연결/권한/node 조회 가능)
3. 프로젝트 컨텍스트 수집/조회 (`docs/project-context.md`)
4. 소스별 어댑터 병렬 분석: figma(@design|@wireframe)→AnalyzeFigmaFrame / 문서→AnalyzeDocument
5. 2단계 머지: (a) 순수 구조 머지 + (b) LLM 정합 패스 → `_conflicts` / `_possibleDuplicates`
6. 충돌·중복후보 해소 + API 필요성 식별 + EARS 형식 askQuestion으로 명세 채우기
7. `docs/specs/pages/<page>/` 디렉토리에 4개 markdown 생성/갱신

## 진입 동작

이 명령은 `dt-spec-generate-spec` 스킬을 트리거한다. 스킬이 다음 스킬들을 오케스트레이션:
- `dt-spec-collect-project-context`
- `dt-spec-analyze-figma` (figma@design·@wireframe 소스에)
- `dt-spec-analyze-document` (markdown/pdf/web 소스에)
- `dt-spec-ask-missing`

자세한 절차는 `skills/dt-spec-generate-spec/SKILL.md` 참조.

## 재실행

기존 산출물이 있으면 헤더 sources를 복원해 소스 union 후 diff 표시 + 사용자 confirm (자동 덮어쓰기 금지). 상세는 design doc(2026-06-01) §8-4.
