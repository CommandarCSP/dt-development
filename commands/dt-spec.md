---
description: Build SDD-format spec documents (requirements.md/design.md/tasks.md/layout-skeleton.md) for a page from multiple sources (Figma nodes, Markdown, PDF, web docs). Outputs to docs/specs/pages/<page>/.
argument-hint: '<locator>[@role] [<locator>[@role] ...] [--source <locator>[@role]] [--api-doc <path>] [--design-system-node-id <id>] [--only requirements|design|tasks|layout-skeleton]'
allowed-tools: Read, Write, Edit, Bash, Task, AskUserQuestion, WebFetch, mcp__claude_ai_Notion__notion-fetch, mcp__atlassian__fetch, mcp__atlassian__getConfluencePage, mcp__atlassian__getConfluenceContent, mcp__atlassian__discover, mcp__atlassian__executeRead, mcp__claude_ai_Atlassian__fetch, mcp__claude_ai_Atlassian__getConfluencePage, mcp__claude_ai_Atlassian__getConfluenceContent, mcp__claude_ai_Atlassian__discover, mcp__claude_ai_Atlassian__executeRead
---

> 설계: `docs/specs/2026-06-01-dt-spec-multi-source-design.md` — 본문의 "dt-spec 설계 §N"은 이 문서의 절을 가리킨다.

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
- `--only requirements|design|tasks|layout-skeleton` (옵셔널): 재실행 시 일부 산출물만 갱신. 지정 파일만 재생성하며 다른 파일(헤더 포함)은 일절 건드리지 않음 — 헤더 버전 혼합 허용 (dt-spec 설계 §8-4)

## 진입 동작

이 명령은 `dt-spec-generate-spec` 스킬을 트리거한다. 스킬이 다음 스킬들을 오케스트레이션:
- `dt-spec-collect-project-context`
- `dt-spec-analyze-figma` (figma@design·@wireframe 소스에)
- `dt-spec-analyze-document` (markdown/pdf/web 소스에)
- `dt-spec-ask-missing`

자세한 절차는 `skills/dt-spec-generate-spec/SKILL.md` 참조.
