---
description: Generate or extend dt-backend (NestJS) module code via multi-agent scaffold workflow
argument-hint: '[new-project|new-module|extend-module] <module-name or feature description>'
allowed-tools: Read, Write, Edit, Bash, Task, AskUserQuestion
---

Run dt-backend scaffold.

Raw arguments: `$ARGUMENTS`

Procedure:

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/dt-backend-scaffold/SKILL.md`

2. Determine intent from `$ARGUMENTS`:
   - If first token is `new-project`, `new-module`, or `extend-module` → use that variant
   - Else, infer from the description (ask via AskUserQuestion if ambiguous)

3. Read the corresponding checklist:
   - `${CLAUDE_PLUGIN_ROOT}/skills/dt-backend-scaffold/checklist/<variant>.md`

4. Follow the checklist step by step. Use Bash to run the shared worktree/gate scripts
   (`${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/scripts/`). Use Task to dispatch Phase 2
   agents (prompts at `${CLAUDE_PLUGIN_ROOT}/skills/dt-backend-scaffold/prompts/<agent>.md`).

5. After completion (or critical failure after 1 repair attempt), summarize:
   - Worktree path
   - Phases completed
   - Final review verdict
   - Next user actions (merge or discard)

This command may take 5-30 minutes depending on module complexity.
