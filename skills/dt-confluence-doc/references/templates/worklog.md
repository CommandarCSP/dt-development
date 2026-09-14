# 작업 요약·진행 정리 템플릿 (type: worklog)

라벨: worklog. 공식 /generate-status-report 패턴 차용(Jira→요약). 피라미드 구조:

1. **요약(헤드라인)** — 이번 기간 핵심 진행 1~3줄 + 전체 상태 배지(`<span data-type="status">`)
2. **완료 / 진행중 / 예정** — 표(`<table>`): [항목 | 상태배지 | Jira키 | 비고]
3. **이슈·리스크** — 패널(`<div data-type="panel-warning">`)로 강조
4. **다음 계획** — `<ul>`

소스: git log/diff(기간) + 현재 세션 + Jira(관련 프로젝트) `searchJiraIssuesUsingJql`. 기간 불명확하면 질문.
