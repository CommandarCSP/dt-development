# 회고 템플릿 (type: retro)

- 구역: **보고·회고** · 제목: `{날짜} {기간·스프린트} 회고` · 라벨: `doc-retro`
- 맨 위에 **공통 머리**를 둔다(TP-003 §2): `node "${CLAUDE_PLUGIN_ROOT}/scripts/wikiConfig.mjs" header --type retro …`가 만든다. 이 종류는 그 시점의 기록이라 검토일이 없다.

## 절 (순서대로, 빈 절은 뺀다)

1. **기간 · 참여자**
2. **잘된 점 / 바꿀 점** — 두 목록(Confluence는 2단 레이아웃 `<section data-type="layout-two-equal">` 가능, markdown은 소제목 둘)
3. **액션 아이템** — 태스크 리스트(담당자 + 기한). 원하면 `/dt-worklog`로 Task

## 소스
`git log`(기간·태그) + 트래커 + 사용자 메모.
