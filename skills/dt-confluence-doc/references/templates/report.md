# 작업 보고 템플릿 (type: report)

- 구역: **보고·회고** · 제목: `{날짜} {기간·주제} 작업 보고` · 라벨: `doc-report`
- 맨 위에 **공통 머리**를 둔다(TP-003 §2): `node "${CLAUDE_PLUGIN_ROOT}/scripts/wikiConfig.mjs" header --type report …`가 만든다. 이 종류는 그 시점의 기록이라 검토일이 없다.

## 절 (순서대로, 빈 절은 뺀다)

1. **요약** — 이번 기간 핵심 1~3줄 + 전체 상태 배지
2. **완료 · 진행 · 예정** — 표 [항목 | 상태 배지 | 이슈 키 | 비고]
3. **이슈·위험** — 경고 패널(`<div data-type="panel-warning">`). 없으면 절째 뺀다
4. **다음 계획** — 목록

## 소스
`git log/diff`(기간) + 세션 + 트래커 검색(`jira.search`). 기간이 불명확하면 묻는다.
