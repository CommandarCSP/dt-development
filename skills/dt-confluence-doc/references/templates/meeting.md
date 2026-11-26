# 회의록 템플릿 (type: meeting)

- 구역: **회의록** · 제목: `{날짜} {회의 주제}` — 연도별 하위 페이지 아래 · 라벨: `doc-meeting`
- 맨 위에 **공통 머리**를 둔다(TP-003 §2): `node "${CLAUDE_PLUGIN_ROOT}/scripts/wikiConfig.mjs" header --type meeting …`가 만든다. 이 종류는 그 시점의 기록이라 검토일이 없다.

## 절 (순서대로, 빈 절은 뺀다)

1. **목적·참석자** — 회의 목적 1~2줄, 일시, 참석자(Confluence는 멘션 `<span data-type="mention">`, 계정 id를 모르면 이름 글자)
2. **안건** — 목록
3. **논의** — 안건별 `<h2>` + 산문. 누가 무엇을 근거로 말했는지 사실 위주
4. **결정 사항** — 결정 리스트(`<ul data-type="decision-list">`). 오래 갈 결정이면 PD 초안을 제안하고(`/dt-decision`) 여기에는 링크만
5. **액션 아이템** — 태스크 리스트(담당자 + 기한). 원하면 `/dt-worklog`로 Task를 만들고 이슈 키를 적는다

## 소스
사용자가 준 회의 내용(`--note`)과 세션. 참석자·기한이 불명확하면 묻는다.
