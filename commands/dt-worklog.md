---
description: 개발 작업(git + 세션 + 메모)을 트래커(기본 Jira)에 Story·Task·Bug로 기록한다 — 설명·진행 댓글·마무리 댓글(산출물이나 결정 사항) 템플릿(TP-002), 조직 규칙은 프리셋. 관련 Confluence 문서가 있으면 댓글에 링크. dry-run 승인 후 쓴다.
argument-hint: '[--since <sha|ref>] [--project <KEY>] [--note "<메모>"] [--dry-run]'
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion, Task, mcp__atlassian__atlassianUserInfo, mcp__atlassian__getAccessibleAtlassianResources, mcp__atlassian__getVisibleJiraProjects, mcp__atlassian__searchJiraIssuesUsingJql, mcp__atlassian__getJiraIssue, mcp__atlassian__createJiraIssue, mcp__atlassian__getTransitionsForJiraIssue, mcp__atlassian__transitionJiraIssue, mcp__atlassian__addCommentToJiraIssue, mcp__atlassian__addWorklogToJiraIssue, mcp__atlassian__getJiraIssueTypeMetaWithFields, mcp__atlassian__searchConfluenceUsingCql, mcp__atlassian__executeRead, mcp__atlassian__addOrEditJiraIssueComment, mcp__atlassian__searchConfluence, mcp__atlassian__discover, mcp__claude_ai_Atlassian__atlassianUserInfo, mcp__claude_ai_Atlassian__getAccessibleAtlassianResources, mcp__claude_ai_Atlassian__getVisibleJiraProjects, mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql, mcp__claude_ai_Atlassian__getJiraIssue, mcp__claude_ai_Atlassian__createJiraIssue, mcp__claude_ai_Atlassian__getTransitionsForJiraIssue, mcp__claude_ai_Atlassian__transitionJiraIssue, mcp__claude_ai_Atlassian__addCommentToJiraIssue, mcp__claude_ai_Atlassian__addWorklogToJiraIssue, mcp__claude_ai_Atlassian__getJiraIssueTypeMetaWithFields, mcp__claude_ai_Atlassian__searchConfluenceUsingCql, mcp__claude_ai_Atlassian__executeRead, mcp__claude_ai_Atlassian__addOrEditJiraIssueComment, mcp__claude_ai_Atlassian__searchConfluence, mcp__claude_ai_Atlassian__discover, mcp__atlassian__editJiraIssue, mcp__claude_ai_Atlassian__editJiraIssue
---

dt-worklog-sync 스킬을 실행해 작업을 Jira에 동기화한다.

Raw arguments: `$ARGUMENTS`

## 인자 (모두 옵셔널)
- `--since <sha|ref>`: 수집 시작점. 미지정 시 `.dt-worklog.local.json`의 lastSyncSha, 그것도 없으면 범위 질문.
- `--project <KEY>`: 이번 실행에 한해 기본 프로젝트 override.
- `--note "<메모>"`: 구두·메신저 요청 등 수동 작업 항목 추가.
- `--dry-run`: 계획만 출력하고 쓰기 도구를 호출하지 않음.

## 동작
`dt-worklog-sync` 스킬의 불변 안전장치와 흐름을 따른다.
