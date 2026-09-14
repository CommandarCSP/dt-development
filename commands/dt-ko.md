---
description: Check Korean prose in the given files (or the git diff) — mechanical lint plus one isolated review pass, shown as before/after and applied only on approval.
argument-hint: '[파일…] [--docType jira|confluence|guide|explain|spec] [--fix]'
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
---

dt-ko 스킬을 실행해 한국어 문장을 검사한다.

Raw arguments: `$ARGUMENTS`

## 인자
- (없음): git 변경분(staged + unstaged) 중 한글 `.md` 를 대상으로 한다.
- `<파일…>`: 그 파일만 본다.
- `--docType <type>`: 경로로 하는 자동 판정을 덮어쓴다(`jira`·`confluence`·`guide`·`explain`·`spec`).
- `--fix`: 표를 보인 뒤 승인 없이 적용한다. **사용자가 미리 허용했을 때만** 쓴다.

## 동작
`dt-ko` 스킬의 절차(§1 대상 → §2 docType → §3 기계 검사 → §4 격리 리뷰 1회 → §5 승인 → §6 적용)를 따른다.
규칙 SOT 는 `docs/refs/readable-writing.md`(A·B·C 묶음)이고, 기계 검사는 `scripts/koWritingLint.mjs`,
문장 리뷰는 `ko-writing-reviewer` 워커 1회다.

**원문을 말없이 고치지 않는다** — 표로 보이고 승인받은 것만 적용한다.
막는 게이트가 아니라 부르면 도와주는 도구다(파이프라인 강제는 `/dt-guide` 의 G7 이 진다).
