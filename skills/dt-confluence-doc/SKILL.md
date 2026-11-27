---
name: dt-confluence-doc
description: Use when the user wants to write a wiki document (Confluence by default, or markdown in the repo) from their dev work — meeting notes, work report, design doc, ops guide, retrospective, release notes, or blameless postmortem (team policy TP-003). Every doc gets a common header (status, owner, review date for design/guide, related issues and decisions, summary), goes under its section page with the title rule, and links back to related tracker issues. Visuals only when they aid understanding. Preview approval before writing. Triggers on "회의록 작성", "작업 보고 컨플루언스에", "설계 문서/운영 가이드 작성", "회고/릴리즈노트/장애 회고", "/dt-confluence". Pairs with dt-worklog-sync.
---

# dt-confluence-doc

개발 작업(git·세션·트래커)을 위키 문서로 쓴다. 문서 규칙의 원본은 팀 정책 `${CLAUDE_PLUGIN_ROOT}/docs/policies/TP-003-wiki-docs.md`다 — 종류 7개, 공통 머리, 페이지 트리, 트래커 연결. 시각 자료는 `references/visual-guideline.md` 기준으로 **유용할 때만** 넣는다. 모든 작성은 **미리보기 승인 후** 실행한다.

> 전제: `wiki: confluence`(기본)면 공식 Atlassian MCP 연결·인증. 본문의 `confluence.*`·`jira.*`·`site.*`는 **하는 일 이름**이다(`${CLAUDE_PLUGIN_ROOT}/docs/refs/wiki-adapter.md`). 실제 도구 이름·인자(v1·v2가 다르다)는 `${CLAUDE_PLUGIN_ROOT}/docs/refs/atlassian-mcp.md`. 시작할 때 그 문서 §1로 v1/v2를 판정하고, 연결이 없으면 §1의 선택지를 준다.

## 불변 안전장치
1. **항상 미리보기 → 승인 후 작성.** [위키 | 스페이스·폴더 | 구역(부모) | 제목 | 라벨 | 공통 머리 | 절 개요]를 표로 보이고 명시 승인받는다. 구역 페이지를 새로 만들 때도 같다.
2. **불명확하면 묻는다.** 스페이스·구역·종류·기간·담당자를 추정하지 않는다.
3. **새 페이지 생성 위주.** 공식 MCP는 기존 페이지의 매크로가 round-trip에서 유실될 수 있다. 기존 페이지는 전체 덮어쓰기 금지 — 더할 내용이 있을 때만 새 절을 덧붙인다(보수적으로).
4. **Confluence 본문은 HTML**(v1 `contentFormat: "html"` · v2 `body: { format: "html", value }`). markdown 위키는 마크다운.

## 설정 로드
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/wikiConfig.mjs" --project . --json
```
결과의 `wiki`·`project`(site·cloudId·스페이스)·`sections`(구역 페이지 id)·`labels`·`reviewMonths`·`warnings`를 이번 실행 내내 쓴다. `warnings`는 사용자에게 한 줄씩 보인다.
- `wiki`가 `notion`·`none`이면(`writes: false`) 흐름 1~3까지만 하고, 본문을 대화에 마크다운으로 보인 뒤 끝낸다.
- `wiki: confluence`인데 `.dt-confluence.json`이 없으면 **최초 실행 위저드**: `confluence.spaces`로 스페이스 목록을 보이고 사용자가 고른다. 키와 숫자 id를 `references/dt-confluence.example.json`에 채워 `.dt-confluence.json`으로 쓴다. `.dt-confluence.local.json`을 만들고 `.gitignore`에 넣는다(승인 후). cloudId·site는 `site.resources`로 확인한다.
- `wiki: markdown`은 설정 파일이 없어도 된다(저장소 `docs/wiki/`).

## 흐름

### 1. 종류 고르기
`--type <meeting|report|design|guide|retro|release|postmortem>` 또는 묻는다. `references/templates/<type>.md`를 읽는다.
- 옛 이름: `worklog` → `report`(경고), `techdoc` → 설계 문서(`design`)인지 운영 가이드(`guide`)인지 묻는다. 옛 `retro`의 릴리즈노트 모드는 `release`다.
- 한 문서에 한 종류만 쓴다. 설계와 사용법이 다 필요하면 둘로 나누고 서로 링크한다(TP-003 §1).

### 2. 수집 (Collect)
템플릿의 "소스"를 따른다. 회의 내용처럼 세션·git에 없는 것은 `--note`로 받는다. 기간·대상·참석자가 불명확하면 묻는다. 관련 이슈 키와 관련 결정(PD·TP)도 함께 모은다.

### 3. 구성 (Compose)
1. **제목** — `node "${CLAUDE_PLUGIN_ROOT}/scripts/wikiConfig.mjs" title --type <종류> --topic "<주제>" [--date YYYY-MM-DD]`. 제목을 따로 짓지 않는다.
2. **공통 머리** — `wikiConfig.mjs header --type <종류> --status <초안|검토 중|확정|폐기> --owner "<담당자>" --issues <키,…> --decisions <PD-…> --summary "<요약 2~3줄>" --format html|markdown`. 담당자 기본은 작성자, 상태 기본은 `확정`(회의록·보고·회고·릴리즈·장애 회고)·`초안`(설계·가이드). 검토일은 스크립트가 종류에 따라 넣는다.
3. **본문** — 템플릿의 절 순서대로. 값이 없는 절은 뺀다. 시각 요소는 visual-guideline 기준 충족 시에만. 다이어그램은 Mermaid 코드블록까지만.
4. **결정·액션** — 오래 갈 결정은 PD 초안을 제안하고(`/dt-decision`) 문서에는 링크만 둔다. 액션 아이템은 담당자·기한과 함께 태스크 리스트로 둔다.
5. **가독성** — `${CLAUDE_PLUGIN_ROOT}/docs/refs/readable-writing.md`를 따르고 그 「텍스트 품질 체크리스트」로 점검한다. 문체(B1)는 「Confluence 산문」 행. 장애 회고는 사람이 아니라 조건·절차를 원인으로 쓴다.
6. **라벨** — `labels[<종류>]`(기본 `doc-<종류>`).

### 4. 구역 확인
종류의 구역은 `TYPES[<종류>].section` → `sections[<구역>]`이다(`--json` 결과).
- **Confluence**: 구역 id가 없으면 스페이스에서 그 이름(`설계`·`운영 가이드`·`회의록`·`보고·회고`·`릴리즈 노트`·`장애 회고`)의 페이지를 찾는다(`confluence.search` — `title = "<이름>" AND space = "<KEY>"`). 없으면 **"'<이름>' 구역 페이지가 없습니다. 스페이스 홈 아래에 만들까요?"**를 묻는다. 승인하면 [6]에서 문서보다 먼저 만든다. 본문은 구역 설명 한 줄과 하위 페이지 목록 매크로다 — `<div data-type="extension" data-extension-key="children" data-extension-type="com.atlassian.confluence.macro.core" data-parameters='{"macroParams":{"all":{"value":"true"}},"macroMetadata":{"schemaVersion":{"value":"1"},"title":"Children Display"}}'></div>`. 만든 id는 `.dt-confluence.json`의 `sections.<구역>`에 적는다(승인 후). 회의록은 그 아래 연도 페이지(`2026`)도 같은 방식으로.
- **markdown**: 경로는 `wikiConfig.mjs path --type <종류> --title "<제목>"`. 폴더는 쓸 때 만든다.

### 5. 미리보기 (Preview)
안전장치 1의 표를 출력하고 승인을 기다린다.
- **한글 리뷰 게이트 (격리, 1회)** — 본문(HTML이면 텍스트 노드만 추려 마크다운으로)을 `Task`로 `ko-writing-reviewer` 에이전트에 넘긴다: `{ text: <본문>, docType: 'confluence' }`. `NEEDS_REPAIR`면 `findings[].after`를 해당 문장에 그대로 끼우고(`needsHuman`은 건너뜀), **before→after 표** [행 | 규칙 | 전 | 후 | 이유]와 "확인 요망" 목록을 보인 뒤 승인받는다. **재리뷰는 하지 않는다.** 서브에이전트를 못 쓰면 lint(`--docType confluence`) + 체크리스트 12항을 메인이 직접 대조하고 한 줄 고지한다.

### 6. 작성 (Apply)
- **Confluence** — 설정값→파라미터: `defaultSpaceId` → 공간 id, 구역 id → 부모 id. `--space <KEY>`로 바꾸면 `confluence.spaces`로 숫자 id를 찾는다. `confluence.create`의 인자 모양이 v1·v2로 다르다(대응표):
  - v1: `cloudId, spaceId, title, body, parentId?, contentFormat: "html"`
  - v2: `cloudId, parent: { spaceId, parentContentId? }, contentType: "page", title, body: { format: "html", value }`. 쓰기 전에 Confluence HTML 규칙(`getContentFormatGuide`)과 공간 지침(`getConfluenceSpace`)을 작업당 한 번 읽는다 — visual-guideline과 다르면 그 규칙을 따른다.
  - 라벨은 생성 뒤 `confluence.labels`로 붙인다(v2 `addLabelsToConfluenceContent`). v1처럼 도구가 없으면 본문 끝에 "라벨: …"을 남기고 보고한다.
  - v2 형식 안내는 base와 `page-html/v1/embeddings` 두 개다(작업당 한 번씩). 안내가 표가 있는 페이지에 자동 시각화(Remix)를 권해도, 넣을지는 visual-guideline(유용할 때만)으로 정한다.
  - 기존 페이지에 덧붙일 때(`confluence.update`) v2는 먼저 `confluence.get`(`detail: "full"`)으로 읽어 받은 `snapshotToken`을 넘긴다. `dryRun: true`로 미리보기를 보일 수 있다.
- **markdown** — 경로에 파일을 쓴다. 커밋은 사람이 한다(알린다).

### 7. 결과
문서 주소를 보고한다. Confluence는 `https://<site>/wiki/spaces/<KEY>/pages/<id>`, markdown은 경로(저장소 웹 주소가 있으면 그것도 — `scripts/gitWebUrl.mjs`).

### 8. 트래커 역링크 — opt-in
주소가 정해진 뒤, 관련 이슈에 문서 링크를 달지 제안한다. **자동 아님 — 미리보기 승인 후.** 링크는 이슈의 **웹 링크** 칸에 단다 — 댓글 줄이 쌓이지 않고, 이슈 화면의 링크 목록에서 바로 보인다.
1. 공통 머리의 관련 이슈를 체크리스트로 보인다. 없으면 "역링크 달 이슈 키를 입력하시겠어요? (건너뛰기 가능)".
2. 이슈마다 `jira.remoteLinks`로 지금 웹 링크를 읽는다. **같은 문서 주소가 이미 있으면 그 이슈는 건너뛴다** — 같은 주소를 다시 넣으면 링크가 둘이 되고, 지우는 도구는 없다.
3. dry-run 표 [이슈 | 현재 상태 | 달 링크 | 방식(웹 링크·건너뜀·댓글)] → 승인.
4. 각 이슈에 `jira.remoteLink`(`url` = 문서 주소, `title` = 문서 제목, `summary` = `{종류} · {작성일}`, `relationship` = `관련 문서`).
5. **웹 링크를 쓸 수 없으면 댓글로 대신한다** — v1 도구만 있거나(웹 링크 도구 없음), 부르다 실패하면 아래 표준 형식으로 `jira.comment(contentFormat: "markdown")`. 댓글로 단 이슈에 같은 문서 링크 댓글이 이미 있으면 다시 달지 않는다. 결과 보고에 어느 이슈가 댓글로 갔는지 적는다.

**표준 역링크 형식** — TP-002 "관련 문서" 줄·`dt-worklog-sync` 3.7과 같은 공유 표준이다(댓글로 대신할 때와 작업 기록 댓글의 "관련 문서" 줄):
- `📄 관련 문서: [{문서 제목}]({문서 주소}) ({종류} · {작성일})`

### 9. 액션 아이템 → Task (opt-in)
회의록·회고·장애 회고의 액션 아이템은 사용자가 원하면 **`/dt-worklog`로 TP-002의 Task**로 만든다(그 스킬의 dry-run을 따른다). 만든 이슈 키를 문서의 액션 아이템 옆에 적는다(기존 페이지 덧붙이기 — 안전장치 3).

## 하는 일 매핑
실제 도구 이름·인자는 `${CLAUDE_PLUGIN_ROOT}/docs/refs/atlassian-mcp.md`(v1·v2), 위키별 지원 상태는 `docs/refs/wiki-adapter.md`.

| 동작 | 하는 일 |
|---|---|
| 스페이스 목록 | `confluence.spaces` |
| 구역 페이지 찾기 | `confluence.pages` · `confluence.search` |
| 문서 생성 · 덧붙이기 | `confluence.create` · `confluence.update` |
| 라벨 | `confluence.labels` |
| 작업 소스(트래커) | `jira.search` · `jira.issue.get` |
| 역링크(웹 링크) | `jira.remoteLinks`(있는지 확인) · `jira.remoteLink`(달기) |
| 역링크를 댓글로 대신 | `jira.comment` |

## 비범위
다이어그램 자동 이미지 렌더, 기존 대형 페이지 부분 편집·머지, 차트 매크로·draw.io, 페이지 권한 관리, 검토일 지난 문서 자동 알림(검토일은 문서에 남기만 한다). 웹 링크 지우기·고치기(도구가 없다 — 잘못 단 링크는 사람이 Jira 화면에서 지운다), 양방향 자동 동기화.
