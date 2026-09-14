---
description: 개발 작업(git + 세션 + 메모)을 ACME JIRA 가이드라인에 맞게 Jira Sub-task로 동기화한다. dry-run 승인 후 생성/상태전이/산출물 첨부. 완료 후 관련 Confluence 문서가 있으면 opt-in으로 Jira 코멘트에 역링크(문서 작성은 안 함).
argument-hint: '[--since <sha|ref>] [--project <KEY>] [--note "<메모>"] [--dry-run]'
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion, Task, mcp__atlassian__atlassianUserInfo, mcp__atlassian__getAccessibleAtlassianResources, mcp__atlassian__getVisibleJiraProjects, mcp__atlassian__searchJiraIssuesUsingJql, mcp__atlassian__getJiraIssue, mcp__atlassian__createJiraIssue, mcp__atlassian__getTransitionsForJiraIssue, mcp__atlassian__transitionJiraIssue, mcp__atlassian__addCommentToJiraIssue, mcp__atlassian__addWorklogToJiraIssue, mcp__atlassian__getJiraIssueTypeMetaWithFields, mcp__atlassian__searchConfluenceUsingCql
---

dt-worklog-sync 스킬을 실행해 작업을 Jira에 동기화한다.

Raw arguments: `$ARGUMENTS`

## 인자 (모두 옵셔널)
- `--since <sha|ref>`: 수집 시작점. 미지정 시 `.dt-worklog.local.json`의 lastSyncSha, 그것도 없으면 범위 질문.
- `--project <KEY>`: 이번 실행에 한해 기본 프로젝트 override.
- `--note "<메모>"`: 구두/메신저 요청 등 수동 작업 항목 추가(가이드라인 기본규칙 6).
- `--dry-run`: 계획만 출력하고 쓰기 도구를 호출하지 않음.

## 동작
`dt-worklog-sync` 스킬의 불변 안전장치와 단계별 흐름을 따른다. 쓰기 전 반드시 dry-run 표로 승인받고,
부모 이슈/전이가 불명확하면 사용자에게 질문한다.
이슈 동기화 후, 관련 Confluence 문서가 있으면 opt-in으로 Jira 코멘트에 역링크를 첨부한다(없으면 스킵, 문서 작성은 dt-confluence-doc).
