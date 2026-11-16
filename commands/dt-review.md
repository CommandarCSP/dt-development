---
description: Run dt-frontend rule and coverage review against current project — bootstraps the stack config if missing, then shows the report verbatim
argument-hint: '[full|partial] [--base <ref>] [--paths file1,file2] [--verbose]'
allowed-tools: Read, Write, Bash, AskUserQuestion
---

dt-frontend-review 스킬의 "단독 실행 절차"를 따른다. 자세한 절차는 `skills/dt-frontend-review/SKILL.md` 참조.

Raw arguments: `$ARGUMENTS`

## 인자
`[full|partial] [--base <ref>] [--paths file1,file2] [--verbose]` — 그대로 리뷰 스크립트에 넘긴다(모드가 없으면 `full`, `--base`가 없으면 `HEAD`).

## 동작
`skills/dt-frontend-review/SKILL.md`의 「단독 실행 절차」 1~5단계를 건너뛰지 않고 따른다 — 스택 설정 확인(없으면 부트스트랩) → 팀 설정 경고 → 실행 → 보고서 그대로 → 후속 안내.
