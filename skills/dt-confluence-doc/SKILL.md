---
name: dt-confluence-doc
description: Use when the user wants to write a Confluence document from their dev work — meeting notes, work/status summary, technical doc/wiki, or retrospective/release notes. Composes content with category templates and adds visuals (tables/code/panels) only when they aid understanding. Triggers on "회의록 작성", "작업 정리 컨플루언스에", "기술문서/위키 작성", "회고/릴리즈노트", "/dt-confluence". Built on the official Atlassian MCP; pairs with dt-worklog-sync.
---

# dt-confluence-doc

개발 작업(git/세션/Jira)을 4개 카테고리 문서로 Confluence에 작성한다.
시각 자료는 `references/visual-guideline.md` 기준으로 **유용할 때만** 넣는다.
모든 작성은 **미리보기 승인 후** 실행한다.

> 전제: 공식 Atlassian MCP 연결·인증. 본문의 `confluence.*`·`jira.*`·`site.*`는 **하는 일 이름**이다 — 실제 도구 이름·인자(v1·v2가 다르다)는 `${CLAUDE_PLUGIN_ROOT}/docs/refs/atlassian-mcp.md`. 시작할 때 그 문서 §1로 v1/v2를 판정하고, 연결이 없으면 §1의 선택지를 준다.

## 불변 안전장치
1. **항상 미리보기 → 승인 후 작성.** 작성할 [스페이스 | 부모 | 제목 | 라벨 | 섹션 개요]를 표로 보여주고 명시 승인받는다.
2. **불명확하면 질문.** 스페이스/부모페이지/타입/기간을 임의 추정하지 않는다.
3. **새 페이지 생성 위주.** 공식 MCP는 기존 페이지 매크로 round-trip 유실 이슈가 있어, 기존 페이지는 전체 덮어쓰기 금지(기존 페이지에 더할 내용이 있을 때만, 새 append 섹션으로 보수적으로).
4. **본문은 HTML**(v1 `contentFormat: "html"` · v2 `body: { format: "html", value }`). 시각 요소는 visual-guideline의 HTML data-type 문법 사용.

## 설정 로드 (계층)
해석 순서: 개인(`.dt-confluence.local.json`) > 팀(`.dt-confluence.json`) > 질문.
1. 소비 프로젝트 루트에서 두 파일 Read 시도.
2. `.dt-confluence.json` 없으면 **최초 실행 위저드**:
   - `confluence.spaces`로 스페이스 목록 제시 → 사용자가 defaultSpaceKey 선택. 그 스페이스의 숫자 id를 defaultSpaceId로 저장.
   - `references/dt-confluence.example.json` 복사해 값 채워 `.dt-confluence.json` 작성.
   - `.dt-confluence.local.json` 생성 + `.gitignore`에 `.dt-confluence.local.json` 추가.
3. cloudId/site는 `site.resources`로 확인 가능.

## 흐름

### 1. 타입 결정
`--type <meeting|worklog|techdoc|retro>` 또는 질문. 해당 `references/templates/<type>.md` 로드.

### 2. 수집 (Collect)
- meeting: 사용자 수동/회의 입력(회의 내용이 세션·git에 없을 때 `--note`로 받는다).
- worklog: `git log/diff`(기간) + 현재 세션 + Jira(관련 프로젝트, 예: SAP) `jira.search`.
- techdoc: git/세션 + 수동.
- retro: `git log`(기간/태그) + Jira.
- 기간/대상/참석자 등 불명확하면 질문.

### 3. 구성 (Compose)
- 템플릿 구조대로 본문을 **HTML**로 작성. 시각 요소는 visual-guideline 기준 충족 시에만(표/코드/패널/상태/태스크·결정 리스트). 다이어그램은 v1에서 mermaid 코드블록까지만.
- **가독성 적용** — 본문 문장은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/readable-writing.md`(규칙 원본)를 따르고, 그 문서의 「텍스트 품질 체크리스트」로 점검한다. 문체(B1)는 그 표의 「Confluence 산문」 행. 처음 보는 독자가 따라 읽을 수 있게 쓴다.
- 라벨 = 설정 labelsByType[type] (+ 필요 라벨).

### 4. 미리보기 (Preview)
[스페이스 | 부모 | 제목 | 라벨 | 섹션 개요]를 표로 출력 → 승인 대기.
- **한글 리뷰 게이트 (격리, 1회)** — 작성한 본문(HTML이면 텍스트 노드만 추려 마크다운으로)을 `Task`로 `ko-writing-reviewer` 에이전트에 넘긴다: `{ text: <본문>, docType: 'confluence' }`. `NEEDS_REPAIR`면 `findings[].after`를 해당 문장에 그대로 끼우고(`needsHuman`은 건너뜀), 사용자에게 **before→after 표** [행 | 규칙 | 전 | 후 | 이유]와 "확인 요망" 목록을 보인 뒤 승인받는다. **재리뷰는 하지 않는다.** 서브에이전트 미가용 시 lint(`--docType confluence`) + 체크리스트 12항을 메인이 직접 대조하고 한 줄 고지한다.

### 5. 작성 (Apply)
- 설정값→파라미터: `defaultSpaceId` → 공간 id, `parentPageId` → 부모 페이지 id. `--space <KEY>`로 override 시엔 키이므로 `confluence.spaces`로 숫자 id를 조회한다. 페이지 URL은 `site` + 생성 응답의 페이지 id로 구성해 보고한다.
- `confluence.create` — 인자 모양이 v1·v2로 다르다(대응표):
  - v1: `cloudId, spaceId, title, body, parentId?, contentFormat: "html"`
  - v2: `cloudId, parent: { spaceId, parentContentId? }, contentType: "page", title, body: { format: "html", value }`. 쓰기 전에 Confluence HTML 규칙(`getContentFormatGuide`)과 공간 지침(`getConfluenceSpace`)을 작업당 한 번 읽는다 — HTML 문법이 visual-guideline과 다르면 그 규칙을 따른다.
- 기존 페이지에 덧붙일 때(`confluence.update`) v2는 먼저 `confluence.get`(`detail: "full"`)으로 읽어 받은 `snapshotToken`을 넘긴다. `dryRun: true`로 미리보기를 보일 수 있다.
- meeting/retro의 액션아이템은 사용자가 원하면 **dt-worklog-sync**로 Jira Sub-task 등록(가이드라인 준수, dry-run).

### 6. 결과
생성된 페이지 URL 보고.

### 7. Jira 역링크 (Backlink) — opt-in
페이지 URL 확정 후, 관련 Jira 이슈에 문서 링크를 코멘트로 첨부할지 제안한다. **자동 아님 — 미리보기 승인 후 실행(안전장치 1).**
1. **2단계(Collect)에서 수집한 관련 Jira 이슈 목록**을 체크리스트로 제시한다.
   - worklog/retro: 이미 수집된 이슈 사용.
   - meeting/techdoc 등 수집 이슈가 없으면: "역링크 달 이슈 키를 입력하시겠어요? (건너뛰기 가능)" 질문. 건너뛰면 단계 종료.
2. 사용자가 대상 이슈 선택 → dry-run 표 [이슈 | 현재상태 | 추가될 코멘트] 출력 → 승인 대기.
3. 승인 시 각 이슈에 아래 표준 역링크 코멘트를 `jira.comment(contentFormat: "markdown")`로 작성한다.
4. 결과 보고에 [이슈 | 코멘트] 추가. 이슈가 불명확하면 임의로 달지 말고 질문한다(안전장치 2).

#### 표준 역링크 코멘트 포맷
- `📄 관련 문서: [{문서 제목}]({Confluence URL}) ({타입} · {작성일})`
- 예: `📄 관련 문서: [5월 4주차 작업 요약](https://your-site.atlassian.net/wiki/spaces/SAP/pages/12345) (worklog · 2026-06-05)`

## MCP 도구 매핑
실제 도구 이름·인자는 `${CLAUDE_PLUGIN_ROOT}/docs/refs/atlassian-mcp.md`(v1·v2). 아래는 이 스킬이 쓰는 하는 일 목록이다.

| 동작 | 하는 일 |
|---|---|
| 스페이스 목록 | `confluence.spaces` |
| 스페이스 내 페이지 탐색 | `confluence.pages` |
| 페이지/콘텐츠 검색 | `confluence.search` |
| 페이지 생성 | `confluence.create` |
| 페이지 수정(보수적) | `confluence.update` |
| 작업 소스(Jira) | `jira.search` / `jira.issue.get` |
| Jira 역링크 코멘트 | `jira.comment` |

## 비범위
다이어그램 자동 이미지 렌더(mermaid-cli), 기존 대형 페이지 부분편집/머지, 차트 매크로/draw.io, 페이지 권한 관리. Jira 역링크는 코멘트만(원격/웹링크 생성 도구 없음), 양방향 자동 동기화·중복 코멘트 업서트는 비범위.
