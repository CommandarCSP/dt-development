---
description: 계속 유효한 결정을 프로젝트 결정(PD)·팀 정책(TP) 문서로 남기고, 찾고, 대체한다. 초안을 보이고 승인받은 뒤에만 쓴다.
argument-hint: '[new|list|supersede <id>|override <키>] [설명]'
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, AskUserQuestion
---

dt-decision 스킬을 실행한다.

Raw arguments: `$ARGUMENTS`

## 인자
- (없음) 또는 `new [설명]`: 새 결정 초안을 만든다.
- `list [--all]`: 채택된 결정(또는 전부)을 보인다.
- `supersede <id> [설명]`: 기존 결정을 새 결정으로 대체한다.
- `override <키>`: 규칙 끄기(`overrides.<키>`)에 근거 결정을 단다.

## 동작
`dt-decision` 스킬의 절차를 따른다. 도구는 `scripts/decisions.mjs`, 양식은 `templates/decision.md.tmpl`, 정책은 `docs/policies/TP-001-decision-records.md`.
