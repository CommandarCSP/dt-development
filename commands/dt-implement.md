---
description: Turn dt-spec page artifacts into code by delegating to the dt-frontend-scaffold engine
argument-hint: '<specDir e.g. docs/specs/pages/file-management>'
allowed-tools: Read, Write, Edit, Bash, Task, AskUserQuestion
---

Run dt-implement (spec → scaffold bridge).

Raw arguments: `$ARGUMENTS`

Procedure:

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/dt-implement/SKILL.md`.
2. Treat `$ARGUMENTS` (first token) as `<specDir>`. If missing, ask the user for the spec directory.
3. Follow SKILL.md: parseSpecForScaffold → draft 확인 → 단일/다중 도메인 분기 → dt-scaffold checklist 위임(Phase 1~4) + {SPEC_EXCERPT} 주입 → 페이지 조립(Phase 5/assembly) → 게이트.
4. After completion (or critical failure), summarize: worktree 경로, 생성 도메인, 페이지, 리뷰 결과, 다음 액션(merge/discard).
