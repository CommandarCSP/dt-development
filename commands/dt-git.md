---
description: 피처 브랜치를 표준 절차로 main에 통합한다. start=origin 최신 main에서 분기, finish=리베이스→--no-ff 머지→main push→피처 브랜치 정리. 각 파괴적 단계는 프리뷰 후 승인. force는 피처 브랜치 수동 업로드 시에만(--force-with-lease), main엔 절대 사용 안 함.
argument-hint: 'start <이름> | finish'
allowed-tools: Read, Bash, AskUserQuestion
---

dt-git-flow 스킬을 실행해 피처 브랜치 워크플로우를 수행한다.

Raw arguments: `$ARGUMENTS`

## 서브커맨드
- `start <이름>`: origin 최신 main에서 피처 브랜치 분기.
- `finish`: 현재 피처 브랜치를 최신화→리베이스→`--no-ff` 머지→main push→정리.

## 동작
`dt-git-flow` 스킬의 불변 안전장치와 단계별 흐름을 따른다.
파괴적 작업(rebase·merge·main push) 전 반드시 계획 프리뷰로 승인받고,
rebase 충돌은 자동 해결하지 않고 멈춰 사용자에게 넘긴다. main엔 절대 force push 하지 않는다.
