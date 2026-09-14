---
description: Run dt-frontend rule and coverage review against current project
argument-hint: '[full|partial] [--base <ref>] [--paths file1,file2] [--verbose]'
allowed-tools: Bash(node:*)
---

Run dt-frontend review.

Raw arguments: `$ARGUMENTS`

Default behavior:
- If no mode specified, defaults to `full`
- If `--base` not specified, use `HEAD` (i.e. uncommitted changes; if no uncommitted changes, the report will show "no changed files")
- Manual Review heuristic stubs (AST-pending rules) are summarized as per-rule counts. Add `--verbose` to expand into full file-by-file listing.

Execute:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-review/scripts/review.mjs" $ARGUMENTS
```

Return the stdout verbatim — do not summarize or modify. The script writes a markdown report.

If exit code is 1 (Ready to merge: No), the user knows critical issues exist.
If exit code is 0 (Ready to merge: Yes/With fixes), no critical issues.
