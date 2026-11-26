---
description: 개발 작업(git/세션/Jira)을 위키 문서로 쓴다(기본 Confluence, 저장소 markdown도). 회의록·작업 보고·설계 문서·운영 가이드·회고·릴리즈 노트·장애 회고 7종, 공통 머리와 구역 페이지(TP-003). 미리보기 승인 후 작성.
argument-hint: '--type meeting|report|design|guide|retro|release|postmortem [--space <KEY>] [--parent <pageId>] [--since <sha|ref>] [--note "<메모>"]'
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion, Task, mcp__atlassian__getAccessibleAtlassianResources, mcp__atlassian__getConfluenceSpaces, mcp__atlassian__getPagesInConfluenceSpace, mcp__atlassian__searchConfluenceUsingCql, mcp__atlassian__createConfluencePage, mcp__atlassian__updateConfluencePage, mcp__atlassian__searchJiraIssuesUsingJql, mcp__atlassian__getJiraIssue, mcp__atlassian__executeRead, mcp__atlassian__searchConfluence, mcp__atlassian__createConfluenceContent, mcp__atlassian__updateConfluenceContent, mcp__atlassian__discover, mcp__claude_ai_Atlassian__getAccessibleAtlassianResources, mcp__claude_ai_Atlassian__getConfluenceSpaces, mcp__claude_ai_Atlassian__getPagesInConfluenceSpace, mcp__claude_ai_Atlassian__searchConfluenceUsingCql, mcp__claude_ai_Atlassian__createConfluencePage, mcp__claude_ai_Atlassian__updateConfluencePage, mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql, mcp__claude_ai_Atlassian__getJiraIssue, mcp__claude_ai_Atlassian__executeRead, mcp__claude_ai_Atlassian__searchConfluence, mcp__claude_ai_Atlassian__createConfluenceContent, mcp__claude_ai_Atlassian__updateConfluenceContent, mcp__claude_ai_Atlassian__discover, mcp__atlassian__addCommentToJiraIssue, mcp__atlassian__addOrEditJiraIssueComment, mcp__claude_ai_Atlassian__addCommentToJiraIssue, mcp__claude_ai_Atlassian__addOrEditJiraIssueComment
---

dt-confluence-doc 스킬을 실행해 Confluence 문서를 작성한다.

Raw arguments: `$ARGUMENTS`

## 인자
- `--type meeting|report|design|guide|retro|release|postmortem`: 문서 종류(없으면 묻는다). 옛 이름 `worklog`는 `report`, `techdoc`은 `design`·`guide` 중 묻는다.
- `--space <KEY>` (옵셔널): 이번 실행 스페이스 override.
- `--parent <pageId>` (옵셔널): 이번 실행에 한해 구역 페이지 대신 쓸 부모.
- `--since <sha|ref>` (옵셔널): 작업 보고·회고·릴리즈 노트 수집 시작점.
- `--note "<메모>"` (옵셔널): 수동 입력(회의록 등).

## 동작
`dt-confluence-doc` 스킬의 불변 안전장치와 흐름을 따른다.
