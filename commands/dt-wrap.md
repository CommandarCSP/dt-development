---
description: 작업 마무리 루틴을 순서대로 진행한다 — 커밋(피처 브랜치) → Confluence 문서 판단 → Jira 동기화. 각 단계는 해당 스킬의 dry-run 승인을 따르며 자동 실행하지 않는다. --init으로 .dt-pipeline.json(opt-in 설정)을 생성.
argument-hint: '[--init]'
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion
---

dt-wrap 스킬을 실행해 작업 마무리 루틴을 진행한다.

Raw arguments: `$ARGUMENTS`

## 인자
- (없음): 커밋 → Confluence 판단 → Jira 동기화 체인 실행.
- `--init`: `.dt-pipeline.json`을 `references/dt-pipeline.example.json` 기준으로 생성(hook opt-in 활성화).

## 동작
`dt-wrap` 스킬의 흐름과 안전장치를 따른다. 각 단계(커밋/문서/Jira)는 해당 스킬의
dry-run 승인을 거치며, 사용자가 단계를 건너뛸 수 있다. main 통합(`/dt-git finish`)은 범위 밖이다.
