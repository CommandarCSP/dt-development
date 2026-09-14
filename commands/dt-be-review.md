---
description: Run dt-backend (NestJS) rule and coverage review against current project
argument-hint: '[full|partial] [--base <ref>] [--paths file1,file2] [--verbose]'
allowed-tools: Bash(node:*)
---

Run dt-backend review (shared engine, backend stack).

Raw arguments: `$ARGUMENTS`

Default behavior:
- If no mode specified, defaults to `full`
- If `--base` not specified, use `HEAD` (uncommitted changes)
- Manual Review heuristic stubs (AST-pending rules) are summarized per-rule. Add `--verbose` to expand.

Execute:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-review/scripts/review.mjs" $ARGUMENTS --stack backend
```

`--stack backend` selects the backend rule directories (`dt-backend-architecture/patterns`,
`dt-backend-testing/patterns`), the `.dt-backend.json` config, and the jest coverage runner.

Return the stdout verbatim — do not summarize or modify. The script writes a markdown report.

If exit code is 1 (Ready to merge: No), critical issues exist.
If exit code is 0 (Ready to merge: Yes/With fixes), no critical issues.
