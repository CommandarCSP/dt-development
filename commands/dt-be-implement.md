---
description: Turn dt-bespec resource artifacts into NestJS code by delegating to the dt-backend-scaffold engine
argument-hint: '<specDir e.g. docs/specs/resources/orders>'
allowed-tools: Read, Write, Edit, Bash, Task, AskUserQuestion
---

Run dt-be-implement (spec → scaffold bridge, backend).

Raw arguments: `$ARGUMENTS`

Procedure:

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/dt-be-implement/SKILL.md`.
2. Treat `$ARGUMENTS` (first token) as `<specDir>` (`docs/specs/resources/<resource>/`). If missing, ask the user.
3. Follow SKILL.md: api-contract.md → Phase 1 contract + schema.delta → draft 확인 → new-module/extend-module 분기 → dt-backend-scaffold checklist 위임(Phase 1~5) + `{SPEC_EXCERPT}` 주입.
4. After completion (or critical failure after 1 repair), summarize: worktree 경로, 생성 모듈, 엔드포인트, full review 결과, 다음 액션(merge/discard).
