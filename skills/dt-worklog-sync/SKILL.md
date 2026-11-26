---
name: dt-worklog-sync
description: >-
  Use when a developer (FE/BE) wants to record their development work in the issue tracker (Jira by default) — summarize git commits/diff + current session + manual notes into Story/Task/Bug issues (Sub-task only when one issue is split among people), written with the standard description template, progress comments, and a closing comment that must carry outputs or decisions before Done (team policy TP-002). Organization-specific rules (forced Sub-task, size, required fields/dates, Epic policy) come from a preset in .dt-worklog.json (basic by default, org-guideline optional). Links already-existing related Confluence docs into the comments. Dry-run approval before every write. Triggers on "작업 Jira에 정리/등록", "worklog 동기화", "/dt-worklog".
---

# dt-worklog-sync

**개발자(FE/BE)의 작업**을 트래커에 기록한다. 기록 규칙의 원본은 팀 정책 `${CLAUDE_PLUGIN_ROOT}/docs/policies/TP-002-task-records.md`다. 조직마다 다른 규칙은 프리셋(`references/presets/`)이 정한다. 모든 쓰기는 **dry-run 승인 후** 실행한다.

> 전제: `tracker: jira`(기본)면 공식 Atlassian MCP가 연결·인증되어 있어야 한다. 본문의 `jira.*`·`confluence.*`·`site.*`·`user.*`는 **하는 일 이름**이다(`${CLAUDE_PLUGIN_ROOT}/docs/refs/tracker-adapter.md`). 실제 도구 이름·인자(v1·v2가 다르다)는 `${CLAUDE_PLUGIN_ROOT}/docs/refs/atlassian-mcp.md`에서 찾는다. 시작할 때 그 문서 §1로 v1/v2를 판정하고, 연결이 없으면 §1의 선택지를 준다.

## 범위
- **대상**: 한 개발자가 자기 작업(커밋·세션·구두 요청)을 기록하는 흐름. 담당자는 늘 인증된 나(`user.me`).
- **범위 밖**: Epic 만들기·전체 일정 관리(PM), 결함 판정·검증 전이(QA), 디자인 작업 기록, 위키 문서 작성(`dt-confluence-doc`).

## 불변 안전장치
1. **항상 dry-run → 승인 후 쓰기.** 쓰기 전에 계획 표와 **채워진 본문 프리뷰**를 보이고 명시 승인받는다.
2. **못 찾거나 불명확하면 묻는다.** 부모·Epic·전이·담당자를 추정하거나 자동 생성하지 않는다.
3. **Done 전에 마무리 댓글.** 마무리 댓글에 프리셋이 요구하는 것(`close.need` — `basic`은 산출물이나 결정 사항)이 없으면 Done을 막고 묻는다. 기계 검사: `node "${CLAUDE_PLUGIN_ROOT}/scripts/worklogConfig.mjs" check-close <댓글 파일>`.
4. **전이 전 실제 가능 전이 검증** — `jira.transitions`로 transition id를 얻어 `jira.transition`에 전달(인자 모양 v1 `transition: { id }` · v2 `transitionId` — 대응표).

## 설정 로드
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/worklogConfig.mjs" --project . --json
```
결과의 `preset`·`rules`(기록 단위·Sub-task·전이·Epic·크기·필수 날짜·산출물 필드·릴리즈·마무리 조건·Bug 댓글)·`project`(site·cloudId·defaultProjectKey)·`tracker`·`git`(커밋·PR 주소 형식)·`warnings`를 이번 실행 내내 쓴다. 키 설명은 `references/presets/README.md`.
- `warnings`가 있으면 사용자에게 한 줄씩 보인다. 특히 "옛 설정 키를 org-guideline으로 봤다"는 경고는 그대로 전한다.
- 프리셋의 규칙 문장은 `references/presets/<preset>.md`를 읽는다. 이 문서의 흐름에서 "프리셋 규칙"이라고 한 곳이 그 문서다.
- `tracker`가 `jira`가 아니면(`writes: false`) 흐름 1·2까지만 하고, [4]의 계획과 본문을 마크다운으로 보인 뒤 끝낸다. 쓰기 도구는 부르지 않는다(`docs/refs/tracker-adapter.md` §1).
- `.dt-worklog.json`이 없으면 아래 **최초 실행 위저드**로 만든다. cloudId·site는 `site.resources`로 확인한다.

### 최초 실행 위저드 (런북 — 그대로 실행)
> **이 절은 런북이다. 각 단계를 순서대로 그대로 실행하되, 단계 사이의 진행 설명·상태 보고는 출력하지 말 것.** 모델이 직접 출력하는 것은 **3단계의 표**와 **4단계의 질문**뿐이다(스크립트 stdout, 특히 5단계의 `✓` 결과는 그대로 전달). `buildProjectCandidates.mjs`를 **열어보지 말 것 — 형식이 불확실해도 아래대로 실행하면 된다.** `example.json`을 **미리 읽지 말 것**(`setup`이 처리). 이 위저드는 **`.dt-worklog.json`이 없을 때만** 진입한다.
>
> **가드레일:** 프로젝트 식별·정렬에 `assignee/reporter = currentUser()` 패턴을 쓰지 않는다(활동 0인 새 프로젝트를 놓침 — *내 이슈 찾기*에서만 사용). 모집단은 조회 가능 전체, 정렬은 `id` 내림차순(최근 생성순).
>
> **오류 처리:** MCP 호출이 실패(미연결·인증 만료·권한 부족·토큰 초과)하거나 스크립트가 비정상 종료하면 — **멈추고 받은 오류를 그대로 전달**한다. 값을 지어내거나 다음 단계로 넘어가지 않는다(안전장치 2). (예외: `setup`의 exit 1은 *키 검증 실패*이므로 5단계대로 표 재노출·재입력.)

1. **cloudId·site** — `site.resources`로 cloudId·site를 얻는다.
2. **목록 호출 (고정 1회)** — `jira.projects`(`action: "browse"`, `maxResults: 50` — v1은 `expandIssueTypes: false`도)를 호출하고, **응답을 가공·검사하지 말고 그대로** `/tmp/dt-wl-projects.json`에 저장한다. `total > 50`이면 `startAt`를 늘려 모든 페이지를 받아 **응답 객체들의 배열**로 같은 파일에 저장한다.
3. **표 출력** — 아래를 실행하고 **출력 표를 그대로** 보인다.
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-worklog-sync/scripts/buildProjectCandidates.mjs" table /tmp/dt-wl-projects.json <site>
   ```
4. **선택 (AskUserQuestion 한 번에 두 질문)** —
   - 프로젝트: 표의 **상위 4행**을 옵션으로(label=`키`, description=`이름`). Other로 키나 브라우즈 URL을 받는다.
   - 기록 규칙: `basic (추천)` — "Story·Task·Bug 단위, Sub-task 선택, 마무리 댓글에 산출물이나 결정 사항(TP-002)" · `org-guideline` — "사내 가이드라인 v1.0: Sub-task 강제, 1~3일, 수행 Epic, 날짜·산출물 필드·릴리즈 필수".
   (AskUserQuestion이 없으면 텍스트로 묻는다.)
5. **검증 + 저장 (한 번에)** — 소비 프로젝트 루트에서 실행한다. **exit 0이면 완료**(`✓ KEY (이름)` 확인), **exit 1이면** 표를 다시 보이고 재입력받는다.
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-worklog-sync/scripts/buildProjectCandidates.mjs" setup /tmp/dt-wl-projects.json "<입력값>" <site> <cloudId> --preset <basic|org-guideline>
   ```

## 흐름

### 1. 수집 (Collect)
- git: `git log <lastSyncSha>..HEAD --oneline` + `git diff <lastSyncSha>..HEAD --stat`. `lastSyncSha`는 설정 결과의 `local.lastSyncSha`이고, 없으면 최근 N개 커밋 또는 범위를 묻는다.
- 현재 세션에서 한 작업(대화 맥락)과 사용자가 붙인 수동 메모·회의 노트를 함께 본다.

### 2. 요약 (Summarize)
- 변경을 **프리셋의 기록 단위**(`rules.unit` — `basic`은 Story·Task·Bug)로 묶는다. 크기는 `rules.size`(`basic`은 한 주 안)를 따른다. 커밋 1:1 매핑 금지.
- **사소한 변경은 이슈로 만들지 않는다.** 관련 이슈의 진행 댓글로 남긴다.
- 단위마다 종류를 정한다: 사용자에게 보이는 기능 = Story, 보이지 않는 기술·운영 작업 = Task, 결함 = Bug(프리셋 규칙이 다르면 그것).
- **본문 슬롯 매핑** — 단위마다 `references/worklog-templates.md`의 프리셋 절(`rules.templates`)에 맞춘다: 새 이슈면 설명, 진행이면 진행 댓글, 끝났으면 마무리 댓글. 못 채우는 슬롯은 `{확인 필요}`.
- **산출물 모으기** — 커밋·PR 주소는 `node "${CLAUDE_PLUGIN_ROOT}/scripts/gitWebUrl.mjs" commit <sha>`(PR은 `pr <번호>`)로 만든다. 단위의 머지 커밋·PR을 우선하고, 없을 때만 주요 커밋을 나열한다. 종료 코드 3(호스트 종류 모름)이면 `github|gitlab|bitbucket` 중 무엇인지 한 번 묻고 `.dt-worklog.json`의 `gitHost`에 적는다(dry-run 승인 후). 문서·테스트 결과·배포 URL도 산출물이다.
- **결정 사항 모으기** — 이번 작업에서 사람이 정한 것(무엇을 왜, 버린 대안)을 세션에서 찾는다. 다른 작업에도 걸리는 결정이면 PD 초안을 제안한다(`/dt-decision`).
- **가독성** — `${CLAUDE_PLUGIN_ROOT}/docs/refs/readable-writing.md`를 따르고 그 「텍스트 품질 체크리스트」로 점검한다. 문체(B1)는 「Jira 설명·코멘트」 행.

### 3. 부모·Epic 찾기 (Resolve)
1. **기존 이슈 먼저** — `jira.search`로 같은 작업의 이슈를 찾는다(예: `assignee = currentUser() AND project = <KEY> AND statusCategory != Done ORDER BY updated DESC`). 있으면 새로 만들지 않고 거기에 댓글을 단다. 고르는 것은 사람이다.
2. **새 이슈면 Epic** — `rules.epic`을 따른다. 맞는 Epic 후보를 보이고 사람이 고른다. `required: false`면 "Epic 없이"도 선택지다. `default`가 있으면 그것을 첫 후보로 둔다. **스킬은 Epic을 만들지 않는다.**
3. **Sub-task** — `rules.subtask: optional`이면 기본은 만들지 않는다. 한 이슈를 여러 사람이 나눌 때, 또는 남의 이슈 일부만 내가 할 때 제안한다(사람이 고른다). `required`면 늘 부모 Story/Task 아래 Sub-task로 기록하고, 부모가 없으면 **"부모 이슈가 없습니다. 새로 만들까요?"** 를 묻는다(프리셋 규칙의 부모 타입 기준).
4. **필수 날짜** — `rules.requiredDates`에 든 종류를 만들 때는 시작·종료일을 받는다. 없으면 묻는다.
5. **의존 관계** — 계층이 아니라 이슈 링크(blocks · relates to)로 제안한다.

### 3.5 수정 버전(릴리즈) — `references/release-matching.md`가 SOT
`rules.releases`를 따른다(그 문서의 "프리셋별 적용" 절 — `required`·`optional`·`off`).
- **부모에 릴리즈가 있으면 하위에 그대로 상속**하고 묻지 않는다. 비어 있으면 번호 목록으로 사람이 고른다. `← 추천`은 표시만 하고 자동 확정하지 않는다.
- 고른 값은 부모에도 쓰고 하위에도 넣는다(Sub-task를 안 만들면 기록하는 이슈 자신이 부모다).
- "릴리즈 없이 진행"은 사람이 고른 결과일 때만. `optional`인데 프로젝트에 릴리즈가 하나도 없으면 묻지 않고 dry-run 표에 그렇게 적는다.
- 결과는 [4] dry-run 표의 수정버전 열에 **부모 갱신 / 부모 상속 / 변경 없음 / 릴리즈 없음**으로 보인다.

### 3.7 관련 문서 (Confluence) — 있으면 같이 링크
이번 작업과 관련된 위키 문서가 **이미 있으면** 진행·마무리 댓글의 "관련 문서" 줄에 넣는다. 자동 아님 — 후보를 보이고 사람이 고른 것만.
1. `confluence.search`로 찾는다. 예: `text ~ "<요약 키워드>" AND type = page ORDER BY lastmodified DESC`. 10건이 넘으면 `space`·`label`로 좁힌다.
2. 후보가 0건이면 이 단계를 끝낸다(묻지 않는다).
3. 후보가 있으면 [문서 → 넣을 이슈·댓글] 매칭을 [4] 표에 함께 보인다. 어느 이슈인지 불명확하면 묻는다. 이슈에 이미 있는 링크는 다시 넣지 않는다.
4. 형식은 `references/worklog-templates.md`의 "관련 문서 줄"이다 — `dt-confluence-doc` §7의 역링크와 같은 공유 표준이다.
5. 이번 기록에 쓸 댓글이 없는 이슈에 문서만 링크할 때는 `📄 관련 문서: …` 한 줄짜리 댓글을 단다.

> 방향 구분: `dt-confluence-doc`는 **문서를 새로 쓸 때** 이슈에 역링크(push), 이 스킬은 **작업을 기록할 때 이미 있는 문서**를 찾아 링크(pull)한다.

### 4. 확인 (Dry-run)
계획을 표로 출력한다: [동작 | 이슈 종류 | Epic·부모 | 제목 | 상태 전이 | 산출물 | 결정 사항 | 수정버전 | 관련 문서]. 산출물 필드를 쓰는 프리셋(`rules.outputField`)이면 그 필드 값 열도 둔다. 승인을 기다린다.
- 표와 함께 **채워진 설명·댓글 마크다운 프리뷰**를 보인다. `{확인 필요}` 슬롯이 있으면 승인 전에 묻는다.
- Done으로 넘길 이슈는 마무리 댓글을 임시 파일로 써서 `worklogConfig.mjs check-close`를 돌리고, 결과를 표의 상태 전이 열에 적는다(막히면 빠진 항목을 묻는다).
- **한글 리뷰 게이트 (격리, 1회)** — 프리뷰 본문을 `Task`로 `ko-writing-reviewer` 에이전트에 넘긴다: `{ text: <프리뷰 마크다운>, docType: 'jira' }`. `NEEDS_REPAIR`면 `findings[].after`를 해당 문장에 **그대로** 끼운다(`needsHuman: true`는 건너뜀). 그다음 **before→after 표** [행 | 규칙 | 전 | 후 | 이유]를 보이고, `needsHuman` 항목은 "확인 요망"으로 따로 적는다. **재리뷰는 하지 않는다.** 서브에이전트를 못 쓰는 런타임이면 `node "${CLAUDE_PLUGIN_ROOT}/scripts/koWritingLint.mjs" <임시파일> --docType jira` + readable-writing.md 체크리스트 12항을 메인이 직접 대조하고, "리뷰를 격리하지 못해 인라인으로 대신했다"고 한 줄 고지한다.

### 5. 실행 (Apply)
- 모든 호출에 `cloudId`를, 생성·검색에는 `projectKey`(`project.defaultProjectKey`)를 전달한다.
- **본문은 `references/worklog-templates.md`의 프리셋 절을 채워 쓴다.** 댓글(`jira.comment`의 `commentBody`)은 `contentFormat: "markdown"`. **완료 조건 체크박스는 HTML로 쓴다.** Jira의 markdown 변환은 `- [ ]`·`- [x]`를 체크박스로 만들지 않고 `[x]` 글자로 저장한다(2026-11-26 DEV-14 기록에서 확인). 체크박스가 든 설명은 `contentFormat: "html"`로 쓰고, 완료 조건은 task list(`<ul data-type="task-list"><li data-type="task-item"><input type="checkbox" checked> …</li></ul>`)로 둔다. 기존 설명을 고칠 때는 `responseContentFormat: "html"`로 읽어 나머지 노드를 그대로 두고 그 부분만 바꾼다(형식 안내: `executeRead` → `getContentFormatGuide({ toolName: "editJiraIssue" })`). 댓글은 markdown 그대로 된다.
- **생성** — `jira.issue.create`. 이슈 유형은 `rules.issueTypes.<종류>` 후보 중 프로젝트에 있는 이름(인자 이름 v1 `issueTypeName` · v2 `issueType`), 담당자 = 나. Epic 아래면 `parent`=Epic 키(인스턴스마다 parent vs Epic Link 필드가 다르니 `jira.fieldMeta`로 확인). Sub-task면 `parent`=부모 이슈 키. 필수 날짜는 종료일 `duedate`, 시작일은 `jira.fieldMeta`로 찾은 필드.
- **산출물 필드 (`rules.outputField`가 있을 때만)** — 필드 id는 설정 `outputField.id`, 없으면 `jira.fieldMeta`로 `outputField.name` 매칭 `customfield_*`. 값은 **ADF** — URL 한 줄 = paragraph 하나(형식은 `references/presets/org-guideline.md`). 못 찾으면 댓글에만 남기고 보고한다(침묵 실패 금지). 필드가 없는 프리셋이면 산출물은 댓글 본문이 자리다.
- **수정 버전(fixVersions) 기재 ([3.5])** — `additional_fields`에 `{ "fixVersions": [ { "id": "<versionId>" } ] }`(기존 이슈면 `jira.issue.edit.fields`). **이름보다 id 우선**(allowedValues에서). **부모와 하위 양쪽에 같은 값** — 부모가 비어 있었으면 부모도 `jira.issue.edit`로 채운다(승인받은 건만). 사람이 "릴리즈 없이 진행"을 골랐거나 프로젝트에 릴리즈가 없으면 넣지 않는다.
- **진행 댓글** — 진행·막힘·검토 대기로 상태를 바꿀 때마다 진행 댓글을 단다(`jira.comment`). 산출물이 아직 없으면 그 줄은 뺀다.
- **완료 (Done 전이)** — 순서를 지킨다:
  1. 설명을 HTML로 읽어 이번 작업으로 충족된 **완료 조건 task item에 `checked`를 단다**(`jira.issue.edit`, `contentFormat: "html"`). 설명에 완료 조건이 없거나 `[x]` 글자로만 있으면 task list로 보강한 뒤 체크한다.
  2. **마무리 댓글**을 단다. `check-close`가 통과한 본문만.
  3. 전이: `jira.transitions` → `rules.transitions`의 완료 이름 후보와 맞는 transitionId로 `jira.transition`.
  - **우산 이슈**(하위가 여러 단계로 나뉜 경우)는 Done 대신 진행 중을 유지하고, 충족된 완료 조건만 체크한 뒤 진행 댓글을 단다.
- **Bug 전이 댓글 (`rules.bugComments`가 있을 때)** — 그 전이 때 해당 내용을 댓글로 남긴다(`org-guideline`: Deployed=해결 방법, Verified=검증 방법 — Verified는 QA 몫이라 이 스킬은 Deployed까지).
- 사용자가 작업 시간을 말했을 때만 `jira.worklog`로 기록한다.

### 6. 상태 기록
- 기록이 끝나면 `HEAD` SHA를 `.dt-worklog.local.json`의 `lastSyncSha`에 저장한다(중복 방지). `tracker: none`이면 사람이 "기록했다"고 확인했을 때만 저장한다.

## 하는 일 매핑
실제 도구 이름·인자는 `${CLAUDE_PLUGIN_ROOT}/docs/refs/atlassian-mcp.md`(v1·v2), 트래커별 지원 상태는 `docs/refs/tracker-adapter.md`.

| 동작 | 하는 일 |
|---|---|
| 내 정보/담당자 | `user.me` |
| cloudId | `site.resources` |
| 프로젝트/이슈 유형 | `jira.projects` |
| 이슈 검색 | `jira.search` |
| 이슈 유형·필드·릴리즈 후보 | `jira.fieldMeta` |
| 관련 문서 검색 | `confluence.search` |
| 이슈 생성 · 수정 | `jira.issue.create` · `jira.issue.edit` |
| 가능 전이 · 전이 | `jira.transitions` · `jira.transition` |
| 댓글 | `jira.comment` |
| 작업 시간 | `jira.worklog` |

## 비범위
- Epic 생성, 전체 일정·우선순위 관리, 여러 담당자 분배(PM 몫).
- 결함 판정(Rejected/Reopened)·검증(Verified)·Closed 전이(QA 몫).
- 위키 페이지 생성·수정(`dt-confluence-doc`). 이 스킬은 위키를 **읽기(검색)만** 한다.
- GitHub·Linear 연동(스텁 — `docs/refs/tracker-adapter.md`).
