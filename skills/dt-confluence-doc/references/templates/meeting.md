# 회의록 템플릿 (type: meeting)

라벨: meeting-notes (+ 팀 라벨). 구조:

1. **개요** — 일시/장소, 참석자(`<span data-type="mention">`), 회의 목적 (1~2줄)
2. **안건(Agenda)** — `<ul>` 항목
3. **논의 내용** — 안건별 `<h2>` + 산문, 필요 시 표/코드
4. **결정 사항** — 결정 리스트 `<ul data-type="decision-list">`
5. **액션 아이템** — 태스크 리스트 `<ul data-type="task-list">` (담당자 mention + 기한)
   - 액션은 dt-worklog-sync로 Jira Sub-task 등록 연계 가능(선택, dry-run).

소스: 사용자 수동/회의 입력. 참석자·기한 불명확하면 질문.
