# 시각 표현 가이드라인 (dt-confluence-doc 참조)

원칙: **시각화는 강제가 아니다.** 산문보다 이해를 더 잘 압축/전달할 때만 골라서 넣는다.
페이지 본문은 `createConfluencePage`의 `contentFormat: "html"` 로 작성한다.

## 무엇을 언제
- **표(table)** — 항목 비교·수치·대조. `<table><thead><tr><th>..</th></tr></thead><tbody><tr><td>..</td></tr></tbody></table>`
- **코드블록(code)** — 코드 예시·설정·명령. `<pre><code class="language-ts">...</code></pre>` (language-* 로 하이라이트)
- **패널(panel)** — 주의/정보/완료 강조. `<div data-type="panel-info"><p>..</p></div>` (info|warning|note|success|error)
- **상태 배지** — 진행 상태. `<span data-type="status" data-color="green">완료</span>` (green|red|yellow|blue|neutral|purple)
- **태스크 리스트** — 액션아이템. `<ul data-type="task-list"><li data-type="task-item"><input type="checkbox"> 항목</li></ul>`
- **결정 리스트** — 회의 결정. `<ul data-type="decision-list"><li data-type="decision-item" data-state="DECIDED">..</li></ul>` (미결정은 data-state="UNDECIDED")
- **2단 레이아웃** — 좌우 대비. `<section data-type="layout-two-equal"><div data-type="column">..</div><div data-type="column">..</div></section>`
- **확장/접기** — 부가 상세. `<details><summary>제목</summary><p>..</p></details>`
- **다이어그램** — 흐름·상태·구조·관계가 산문보다 명확할 때만. **v1은 이미지 렌더 안 함**: Mermaid 코드를 `<pre><code class="language-mermaid">..</code></pre>` 로 보관(가독). 자동 이미지화는 후속.

## 하지 말 것
- 장식적 삽입(내용 없는 표, 의미 없는 패널) 금지.
- `<html>/<head>/<body>` 래핑 금지. 인라인 요소 안에 블록 요소 금지. 표 셀 안 heading 금지.
- 그 외 일반 서술은 산문(`<p>`, `<h2>` 등)으로.
