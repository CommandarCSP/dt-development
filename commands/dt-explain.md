---
description: Explain a discovered problem (Jira ticket, bug, issue) in structured plain language — evidence-labeled cause chain, project-grounded example, 2-3 solutions with downsides, one-line summary.
argument-hint: '<티켓키 또는 문제 설명> [--quick]'
allowed-tools: Read, Bash, Grep, Glob, Task, AskUserQuestion, mcp__atlassian__getJiraIssue
---

dt-explain 스킬을 실행해 문제를 구조화된 쉬운 답변으로 설명한다.

Raw arguments: `$ARGUMENTS`

## 인자
- `<티켓키 또는 문제 설명>`: 지라 티켓 키(예: PROJ-99), 에러 메시지, 자유 텍스트 문제 서술.
- `--quick` (옵셔널): 퀵 모드 강제 — 원인이 자명하지 않으면 풀 모드로 승격하고 사유를 말한다.

## 동작
`dt-explain` 스킬의 절차를 따른다: 입력 파악 → 근거 확보(코드 직접 확인, 🟢/🟡 라벨)
→ 풀/퀵 모드 판정 → `references/answer-frame.md` 골격으로 작성 → 자가 게이트 후 출력.
채팅 답변 전용 — 지라 코멘트 등 외부 쓰기는 하지 않는다.
