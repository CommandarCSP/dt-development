---
description: 개발 작업(git/세션/Jira)을 Confluence 문서로 작성한다. 회의록/작업요약/기술문서/회고·릴리즈노트 4종. 시각 자료는 유용할 때만. 미리보기 승인 후 작성.
argument-hint: '--type meeting|worklog|techdoc|retro [--space <KEY>] [--parent <pageId>] [--since <sha|ref>] [--note "<메모>"]'
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion, Task, mcp__atlassian__getAccessibleAtlassianResources, mcp__atlassian__getConfluenceSpaces, mcp__atlassian__getPagesInConfluenceSpace, mcp__atlassian__searchConfluenceUsingCql, mcp__atlassian__createConfluencePage, mcp__atlassian__updateConfluencePage, mcp__atlassian__searchJiraIssuesUsingJql, mcp__atlassian__getJiraIssue
---

dt-confluence-doc 스킬을 실행해 Confluence 문서를 작성한다.

Raw arguments: `$ARGUMENTS`

## 인자
- `--type meeting|worklog|techdoc|retro` (필수): 문서 카테고리.
- `--space <KEY>` (옵셔널): 이번 실행 스페이스 override.
- `--parent <pageId>` (옵셔널): 부모 페이지 override.
- `--since <sha|ref>` (옵셔널): worklog/retro 수집 시작점.
- `--note "<메모>"` (옵셔널): 수동 입력(회의록 등).

## 동작
`dt-confluence-doc` 스킬의 불변 안전장치와 흐름을 따른다. 본문은 contentFormat "html"로 작성하고,
작성 전 반드시 미리보기 표로 승인받으며, 스페이스/부모/타입이 불명확하면 사용자에게 질문한다.
