---
description: Build the project-level development definition (docs/specs/definition.md) — the Source of Truth for FE/BE scope split, interface contracts, and change traceability — from multi-source UX (Figma pages, PDF, links, Markdown). Consumed by dt-spec(FE) and dt-bespec(BE) at their §0 gate.
argument-hint: '<locator> [<locator> ...] [--source <locator>] [--scope <slug>]'
allowed-tools: Read, Write, Edit, Bash, Task, AskUserQuestion, WebFetch
---

Run dt-devspec to generate the project development definition (project SOT).

Raw arguments: `$ARGUMENTS`

## 인자

- `<locator>` (1개 이상): 소스 locator를 나열한다. locator 종류:
  - Figma 페이지 URL (`figma.com/design/<fileKey>/...`) 또는 노드 id — 화면은 전부 받는다
  - 파일 경로 (예: `./docs/req/overview.md`, `./docs/spec.pdf`)
  - URL (Notion `notion.so/...` / Confluence `*.atlassian.net/...` / 일반 `https://...`)
- `--source <locator>` (옵셔널): positional과 동일 의미. 자동감지가 틀릴 때 `type:locator` prefix 사용 (예: `--source markdown:./weird:name.txt`)
- `--scope <slug>` (옵셔널 — 다중 스코프): 전역 규약이 다른 독립 스코프(예: `backoffice`)를 분리할 때 지정한다. 지정 시 산출은 `docs/specs/definition.<slug>.md`, 미지정 시 `docs/specs/definition.md`. `<slug>`=kebab.

## 진입 동작

이 명령은 `dt-devspec` 스킬을 트리거한다. 스킬이 멀티소스를 발견(경량 `get_metadata`)하고, 데이터가 있는 화면만 우측 주석 영역을 대상 deep-read(`get_design_context`)해 인터페이스(IF) 계약을 추출한 뒤, 프로젝트 정의서 `docs/specs/definition.md`(FE/BE 범위 분담 + 인터페이스 합의 + 변경 추적)를 생성한다.

- 산출물: `docs/specs/definition.md` (스코프 지정 시 `docs/specs/definition.<slug>.md`) — 프로젝트당 1개.
- 재실행은 diff-then-confirm (자동 덮어쓰기 금지). 전역 규약은 보존하고 IF/SP만 재추론·diff한다.

자세한 절차는 `skills/dt-devspec/SKILL.md` 참조.

## 다음 단계

정의서가 생성되면 `dt-spec`(FE 페이지 스펙)·`dt-bespec`(BE 리소스 스펙)이 각자의 §0 게이트에서 이 정의서를 소비(consume)한다. 정의서가 없거나 엉성해도 두 스킬은 소프트 게이트로 분기하므로 dt-devspec은 선택적 선행 단계다.
