---
description: Build the project-level development definition (docs/specs/definition.md) — the Source of Truth for FE/BE scope split, interface contracts, and change traceability — from planning/UX sources of any kind (Notion, Confluence, PDF, Markdown, web links, and Figma when available). Consumed by dt-spec(FE) and dt-bespec(BE) at their §0 gate.
argument-hint: '<locator> [<locator> ...] [--source <locator>] [--primary <locator>] [--scope <slug>]'
allowed-tools: Read, Write, Edit, Bash, Task, AskUserQuestion, WebFetch, mcp__claude_ai_Notion__notion-fetch, mcp__notion__notion-fetch, mcp__atlassian__fetch, mcp__atlassian__getConfluencePage, mcp__atlassian__getConfluenceContent, mcp__atlassian__discover, mcp__atlassian__executeRead, mcp__claude_ai_Atlassian__fetch, mcp__claude_ai_Atlassian__getConfluencePage, mcp__claude_ai_Atlassian__getConfluenceContent, mcp__claude_ai_Atlassian__discover, mcp__claude_ai_Atlassian__executeRead
---

Run dt-devspec to generate the project development definition (project SOT).

Raw arguments: `$ARGUMENTS`

## 인자

- `<locator>` (1개 이상, 어느 종류든 하나면 된다 — Figma 없어도 됨): 소스 locator를 나열한다. locator 종류:
  - URL (Notion `notion.so/...` / Confluence `*.atlassian.net/...` / 일반 `https://...`)
  - 파일 경로 (예: `./docs/req/overview.md`, `./docs/spec.pdf`)
  - Figma 페이지 URL (`figma.com/design/<fileKey>/...`) 또는 노드 id — 화면은 전부 받는다
- `--source <locator>` (옵셔널): positional과 동일 의미. 자동감지가 틀릴 때 `type:locator` prefix 사용 (예: `--source markdown:./weird:name.txt`)
- `--primary <locator>` (옵셔널): 화면·기능의 존재를 다툴 때 기준이 되는 주 소스. 없으면 Figma, Figma도 없으면 첫 기획 문서(문서가 둘 이상이면 묻는다).
- `--scope <slug>` (옵셔널 — 다중 스코프): 전역 규약이 다른 독립 스코프(예: `backoffice`)를 분리할 때 지정한다. 지정 시 산출은 `docs/specs/definition.<slug>.md`, 미지정 시 `docs/specs/definition.md`. `<slug>`=kebab.

## 진입 동작

이 명령은 `dt-devspec` 스킬을 트리거한다. 스킬이 소스(기획 문서·Figma)를 가볍게 훑어 화면·기능을 찾고, 데이터가 오가는 화면·절만 한 번씩 본문을 읽어 인터페이스(IF) 계약을 추출한 뒤, 프로젝트 정의서 `docs/specs/definition.md`(FE/BE 범위 분담 + 인터페이스 합의 + 변경 추적)를 생성한다.

- 산출물: `docs/specs/definition.md` (스코프 지정 시 `docs/specs/definition.<slug>.md`) — 프로젝트당 1개.
- 재실행은 diff-then-confirm (자동 덮어쓰기 금지). 전역 규약은 보존하고 IF/SP만 재추론·diff한다.

자세한 절차는 `skills/dt-devspec/SKILL.md` 참조.

## 다음 단계

정의서가 생성되면 `dt-spec`(FE 페이지 스펙)·`dt-bespec`(BE 리소스 스펙)이 각자의 §0 게이트에서 이 정의서를 소비(consume)한다. 정의서가 없거나 엉성해도 두 스킬은 소프트 게이트로 분기하므로 dt-devspec은 선택적 선행 단계다.
