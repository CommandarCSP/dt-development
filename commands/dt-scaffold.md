---
description: Generate or extend dt-frontend domain code via multi-agent scaffold workflow
argument-hint: '[new-project|new-domain|extend-domain] <domain-name or feature description>'
allowed-tools: Read, Write, Edit, Bash, Task, AskUserQuestion
---

Run dt-frontend scaffold.

Raw arguments: `$ARGUMENTS`

Procedure:

1. Read `${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/SKILL.md`

2. Determine intent from `$ARGUMENTS`:
   - If first token is `new-project`, `new-domain`, or `extend-domain` → use that variant
   - Else, infer from the description (ask user via AskUserQuestion if ambiguous)

3. Read the corresponding checklist:
   - `${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/checklist/<variant>.md`

4. Follow the checklist step by step. Use Bash to run worktree/gate scripts. Use Task to dispatch Phase 2 agents (prompts at `${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-scaffold/prompts/<agent>.md`).

5. After completion (or critical failure after 1 repair attempt), summarize:
   - Worktree path
   - Phases completed
   - Final review verdict
   - Next user actions (merge or discard)

This command may take 5-30 minutes depending on domain complexity.
