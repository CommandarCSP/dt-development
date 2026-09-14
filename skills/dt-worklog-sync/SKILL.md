---
name: dt-worklog-sync
description: >-
  Use when a developer (FE/BE) wants to sync their development work to Jira following the ACME JIRA guideline — summarize git commits/diff + current session + manual notes into Jira Sub-tasks (the developer's unit) under a Story/Task, transition status, and attach deliverable links. If no parent Story/Task exists, asks the user and (on consent) creates one — Story for screen/feature dev, Task for non-screen dev work (요구사항분석·설계·인프라·배포 등) under the 수행 Epic. Out of scope: design(UX/Visual) sub-tasks, QA bug verification, PM Epic/Story management. Also optionally attaches an existing Confluence doc link as a Jira comment (read-only — doc authoring is dt-confluence-doc). Triggers on "작업 Jira에 정리/등록", "worklog 동기화", "/dt-worklog".
---

# dt-worklog-sync

**개발자(FE/BE)의 개발 작업**을 **ACME JIRA 가이드라인**(`references/jira-guideline.md`)에 맞게 Jira에 동기화한다.
기본 단위는 **Sub-task**(가이드라인 "개인이 수행할 실제 업무 단위"). 모든 쓰기는 **dry-run 승인 후** 실행한다.

## 범위 (개발자 전용)
- **대상**: 한 개발자가 자기 **개발 작업**(커밋/세션/구두요청)을 Sub-task로 기록하는 흐름.
- **부모**: Sub-task는 항상 Story/Task 아래. 없으면 **사용자 확인 후 생성**(흐름 3) — 화면/기능 개발=**Story**, 화면 외 개발 작업(요구사항분석·설계·인프라·배포 등)=**Task**.
- **범위 밖(다른 역할 소관)**: 디자인(UX/Visual) Sub-task, QA의 Bug 검증(Verified)·Closed 전이, PM의 Epic·전체 Story 관리. Bug는 개발자가 닿는 부분(Deployed 해결방법 댓글)까지만 다룬다.
- **컴포넌트**: 개발 작업은 보통 `Dev`(가이드라인 컴포넌트).

> 전제: 공식 Atlassian MCP가 연결·인증되어 있어야 한다(`mcp__atlassian__*`).
> 미연결 시: `claude mcp add --scope user --transport http atlassian https://mcp.atlassian.com/v1/mcp` 안내 후 `/mcp`로 인증 요청.

## 불변 안전장치
1. **항상 dry-run → 승인 후 쓰기.** 쓰기 도구 호출 전 계획 표와 **채워진 본문 프리뷰**를 보여주고 명시 승인받는다.
2. **못 찾거나 불명확하면 사용자에게 질문.** 부모 이슈/전이/담당자를 임의 추정하거나 자동 생성하지 않는다.
3. **Done 전이 시 산출물 링크 필수.** 첨부할 커밋/MR 링크가 없으면 Done을 막고 사용자에게 알린다. 산출물 링크의 **1차 위치는 산출물(Output) 커스텀 필드**(`references/output-field-rules.md`) — 커밋을 코멘트/설명에만 남기지 말고 **커밋/MR의 GitLab URL을 산출물 필드에 기재**한다.
4. **전이 전 실제 가능 전이 검증** — `getTransitionsForJiraIssue`로 transition id를 얻어 `transitionJiraIssue`에 `transition: { id }` 형태로 전달.

## 설정 로드 (계층)
해석 순서: 개인(`.dt-worklog.local.json`) > 팀(`.dt-worklog.json`) > 대화형 질문.
1. 소비 프로젝트 루트에서 두 파일을 Read 시도. 둘 다 있으면 위저드를 건너뛴다.
2. `.dt-worklog.json`이 없으면 아래 **최초 실행 위저드**로 `defaultProjectKey`만 사람이 고른다.
3. cloudId/site는 `getAccessibleAtlassianResources`로 자동 확인한다.

### 최초 실행 위저드 (런북 — 그대로 실행)
> **이 절은 런북이다. 각 단계를 순서대로 그대로 실행하되, 단계 사이의 진행 설명·상태 보고는 출력하지 말 것** — 모델이 직접 출력하는 것은 **3단계의 표**와 **4단계의 프로젝트 선택 질문**뿐이다(스크립트 stdout, 특히 5단계의 `✓` 결과는 그대로 전달). `buildProjectCandidates.mjs`를 **열어보지 말 것 — 형식이 불확실해도 아래대로 실행하면 된다**(입력·출력은 아래에 명시됨). `example.json`을 **미리 읽지 말 것**(`setup`이 처리). 이 위저드는 **`.dt-worklog.json`이 없을 때만** 진입한다("설정 로드" 게이트).
>
> **가드레일:** 프로젝트 식별·정렬에 `assignee/reporter = currentUser()` 패턴을 쓰지 않는다(활동 0인 새 프로젝트를 놓쳐 곁길로 샘 — 흐름 3처럼 KEY가 정해진 뒤 *내 이슈 찾기*에서만 사용). 모집단은 항상 조회 가능 전체, 정렬은 `id` 내림차순(최근 생성순; 생성일 필드가 없어 `id` 대용).
>
> **오류 처리:** 어느 단계든 MCP 호출이 실패(미연결·인증 만료·권한 부족·토큰 초과)하거나 스크립트가 비정상 종료하면 — **멈추고 받은 오류를 사용자에게 그대로 전달**하며, 값을 지어내거나 다음 단계로 넘어가지 않는다(안전장치 2). MCP 미연결·미인증이면 본문 상단 안내(`claude mcp add …` → `/mcp`)를 따른다. (예외: `setup`의 exit 1은 *키 검증 실패*이므로 5단계대로 표 재노출·재입력.)

1. **cloudId·site** — `getAccessibleAtlassianResources`로 cloudId·site를 얻는다.
2. **목록 호출 (고정 1회)** — `getVisibleJiraProjects(action="browse", expandIssueTypes=false, maxResults=50)`를 호출하고, **응답을 가공·검사하지 말고 그대로** `/tmp/dt-wl-projects.json`에 저장한다(스크립트가 이 형식을 직접 받는다). `total > 50`이면 `startAt`를 늘려 모든 페이지를 받아 **응답 객체들의 배열**로 같은 파일에 저장한다.
3. **표 출력** — 아래를 실행하고 **출력 표를 그대로** 사용자에게 보여준다.
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-worklog-sync/scripts/buildProjectCandidates.mjs" table /tmp/dt-wl-projects.json <site>
   ```
4. **선택 (AskUserQuestion)** — 표의 **상위 4행(최근 생성순)** 을 클릭 옵션으로 AskUserQuestion을 띄운다: 질문="어느 프로젝트에 작업을 기록할까요? (표에 없는 프로젝트는 Other에 키/URL 입력)", 각 옵션 label=`키`, description=`이름`. Other(자동 제공)로 키나 브라우즈 URL을 직접 입력받는다. (AskUserQuestion이 없는 환경이면 텍스트로 키 입력을 요청한다.)
5. **검증 + 저장 (한 번에)** — 사용자 입력으로 아래를 실행한다. 이 한 번이 **키 검증 + `.dt-worklog.json` 작성 + `.dt-worklog.local.json` 생성 + `.gitignore` 등록**을 모두 처리한다. **exit 0이면 완료**(출력의 `✓ KEY (이름)`으로 맞는 프로젝트인지 확인), **exit 1이면** 표를 다시 보여주고 재입력받는다. 이 명령은 **소비 프로젝트 루트에서 실행한다** — 설정 파일이 `cwd`(= 그 디렉터리)에 작성된다. (cwd가 그 루트가 아닐 때만 마지막 인자로 루트 절대경로를 넘긴다.)
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/skills/dt-worklog-sync/scripts/buildProjectCandidates.mjs" setup /tmp/dt-wl-projects.json "<입력값>" <site> <cloudId>
   ```

## 흐름

### 1. 수집 (Collect)
- git: `git log <lastSyncSha>..HEAD --oneline` + `git diff <lastSyncSha>..HEAD --stat`
  (`lastSyncSha`는 `.dt-worklog.local.json`. 없으면 최근 N개 커밋 또는 사용자에게 범위 질문.)
- 현재 세션에서 한 작업(대화 맥락)을 함께 고려.
- 사용자가 붙인 수동 메모/회의노트가 있으면 포함.

### 2. 요약 (Summarize)
- 변경을 **1~3일 작업 단위**로 묶는다(가이드라인 룰 2). 커밋 1:1 매핑 금지. 3일 초과는 "(1)(2)" 차수 분리.
- 가이드라인 X 예시(버튼 색 변경·문구 수정 등 사소한 변경)는 **개별 이슈로 만들지 않는다**.
- 각 단위는 개발자의 **Sub-task가 기본**(개발 결함 작업이면 Bug). 부모(Story/Task) 타입은 [3]에서 결정한다.
- **본문 슬롯 매핑** — 각 단위를 `references/worklog-templates.md`의 description 슬롯(What/Why/How/DoD, Bug는 변형)에 매핑한다. 맥락에서 못 채우는 슬롯은 임의로 지어내지 말고 `{확인 필요}`로 둔다.
- **산출물(Output) 필드 매핑** — 각 단위의 산출물을 `references/output-field-rules.md` 규칙대로 모은다. 개발 작업은 보통 **커밋/MR의 GitLab URL**이다: `git remote get-url origin`(또는 설정 `gitWebBaseUrl`)에서 웹 베이스를 도출(ssh→https)하고, 작업 단위의 **머지 커밋 URL을 우선**(`<베이스>/-/commit/<sha>`), 필요 시 주요 파트 커밋 URL을 줄바꿈으로 나열한다. 파일 산출물(설계서·테스트결과)은 첨부 후 파일명을 함께 적는다. 이 값이 [4] dry-run 표·[5] 산출물 필드 기재의 입력이다.
- **가독성 적용** — 슬롯을 채울 때 `${CLAUDE_PLUGIN_ROOT}/docs/refs/readable-writing.md`를 따른다: 약어는 첫 등장에서 풀어쓰고(A1), 내부 용어·파일명엔 한 줄 설명을 붙이며(A2), Jira 설명은 개조식 문체로 통일한다(B1). 기계에 사람 행위를 붙이지 않고(C1), `~에 의해`·`~을 통해` 같은 번역투와 `수행·존재·해당` 같은 낯선 말을 쓰지 않는다(C2·C3). 새로 보는 사람이 따라 읽을 수 있게 쓴다.

### 3. 부모 매칭/생성 (Resolve) — 검색 → 없으면 사용자 확인 후 생성
개발자의 Sub-task는 **반드시 부모 Story/Task 아래**에 둔다(가이드라인 기본규칙 1). 담당자 = 인증된 나(`atlassianUserInfo`).

1. **기존 이슈 업데이트**면: `searchJiraIssuesUsingJql`로 내 담당·최근 Sub-task 검색
   (예: `assignee = currentUser() AND project = <KEY> ORDER BY updated DESC`) → 사용자 선택.
2. **신규 Sub-task의 부모 검색**: 이 작업이 속할 Story/Task를 JQL로 찾아 후보 제시 → 사용자 선택.
   - 화면/기능 개발이면 **같은 화면의 Story가 이미 있으면 재사용**한다. UX·GUI·개발용 Story를 따로 만들지 않는다(가이드라인 "스토리" 주의: 같은 화면 Story는 공유).
3. **적합한 부모가 없으면 — 자동 생성 금지. 사용자에게 "부모 이슈가 없습니다. 새로 만들까요?"를 묻는다**(안전장치 2). 동의 시에만 부모를 생성하며, 타입을 아래로 결정한다(가이드라인 FAQ 3 / 이슈 유형 정의):

   | 작업 성격 | 부모 타입 |
   |---|---|
   | **화면 단위 개발**(특정 화면 구현) 또는 기능 단위 개발(예: 기능 A API 구현) | **Story** |
   | **화면 외 개발 작업**(요구사항 분석·FE/API/DB 설계·공통 컴포넌트·인프라 구성·배포·변경 이력) | **Task** |
   | 개발 기능 **결함** | Bug (부모 아님 — 별도 트랙) |

   - 부모 Story/Task는 보통 **`수행` Epic** 아래에 둔다. Epic은 QA가 Space 생성 시 제공(관리/수행/검수/변경 이력/배포 및 오픈) — **스킬은 Epic을 만들지 않는다**. 어느 Epic 아래일지 불명확하면 질문한다(기본 후보=수행).
   - **Story/Task 생성 시 시작일·종료일 필수**(가이드라인 기본규칙 5 / Sub-task·Bug는 불필요). 값이 없으면 질문(미정이면 예상 일정).
   - 생성된 부모 아래에 Sub-task를 만든다.

모든 부모/Sub-task 생성은 **dry-run 표 승인 후** 실행한다(안전장치 1).

### 3.5 수정 버전(릴리즈/마일스톤) 매칭 (릴리즈가 있을 때만 — `references/release-matching.md`)
프로젝트에 릴리즈(마일스톤)가 정의돼 있으면 각 Sub-task를 그 릴리즈에 매칭해 **수정 버전(fixVersions)** 필드를 채운다.
1. **릴리즈 목록 조회** — 버전 전용 도구가 없으므로 `getJiraIssueTypeMetaWithFields`(대상=설정 `subtask` 타입)의 `fixVersions.allowedValues`로 후보를 얻는다. **빈 배열이면 릴리즈 미정의 → 이 단계 스킵**(필드 비움). `archived`는 제외.
2. **의미 매칭 우선** — 티켓 요약·작업 범위(What/Why)를 릴리즈 **이름·설명**과 대조해 가장 맞는 1개를 고른다. `releaseDate`는 보조 tiebreaker.
3. **애매하면 무조건 사용자 확인** — 단일 신뢰 매칭이 안 나오거나(0개/복수 비등), 범위가 여러 릴리즈에 걸치거나, 이름·설명이 빈약하면 **자동 확정 금지** → 후보(이름·releaseDate·설명 요약)+"매칭 안 함"을 제시해 사용자에게 묻는다(안전장치 2). 임의 추정 금지.
4. **대상=Sub-task**(설정 `fixVersionsTarget`, 기본 `subtask`). 매칭 결과를 [4] dry-run 표의 수정버전 열에 노출한다.

### 4. 확인 (Dry-run)
계획을 표로 출력: [동작 | 이슈타입 | 부모 | 제목 | 상태전이 | **산출물(Output) 필드 값** | **수정버전(릴리즈)**]. 사용자 승인 대기. 산출물 필드 값은 [2]에서 모은 커밋/MR URL·파일명을 줄바꿈으로 보여준다(빈 값이면 그 사유). 수정버전 열은 [3.5] 매칭 결과(릴리즈명 또는 "미정의—스킵"/"애매—확인 필요")를 보여준다.
- 표와 함께 **채워진 description/comment 마크다운 프리뷰**를 출력한다. `{확인 필요}` 슬롯이 있으면 승인 전에 질문한다.
- **한글 리뷰 게이트 (격리, 1회)** — 프리뷰 본문(description·comment 마크다운)을 `Task`로 `ko-writing-reviewer` 에이전트에 넘긴다: `{ text: <프리뷰 마크다운>, docType: 'jira' }`. 반환 `verdict`가 `NEEDS_REPAIR`면 `findings[].after`를 해당 문장에 **그대로** 끼운다(`needsHuman: true`는 건너뜀). 그다음 사용자에게 **before→after 표** [행 | 규칙 | 전 | 후 | 이유]를 보이고, `needsHuman` 항목은 아래에 "확인 요망"으로 따로 적는다. 승인받는다. **재리뷰는 하지 않는다**(정확히 1회). 서브에이전트를 못 쓰는 런타임이면 `node "${CLAUDE_PLUGIN_ROOT}/scripts/koWritingLint.mjs" <임시파일> --docType jira` + readable-writing.md 체크리스트 12항을 메인이 직접 대조하고, "리뷰를 격리하지 못해 인라인으로 대신했다"고 한 줄 고지한다.

### 5. 실행 (Apply)
- 모든 Atlassian 호출에 `cloudId`(설정 또는 `getAccessibleAtlassianResources`)를 전달한다. 생성/검색은 `projectKey`(설정의 defaultProjectKey)도 필요.
- **본문은 `references/worklog-templates.md` 템플릿을 채워서 쓴다.** `createJiraIssue`의 `description`·`addCommentToJiraIssue`의 `commentBody` 모두 `contentFormat: "markdown"`을 전달한다.
- 생성: `createJiraIssue` (Sub-task는 `parent`=부모 Story/Task 키, `issueTypeName`=설정값, `assignee_account_id`=나).
  - **산출물(Output) 커스텀 필드 기재 (필수 — `references/output-field-rules.md`):** [2]에서 모은 산출물(커밋/MR GitLab URL·파일명)을 산출물 필드에 넣는다. **값은 ADF(리치텍스트) 필수** — URL 한 줄 = paragraph 하나인 `{type:"doc"...}` 객체로 만들어 `createJiraIssue`의 `additional_fields`(또는 기존 이슈면 `editJiraIssue`의 `fields`)에 `{ "<outputFieldId>": <ADF doc> }`로 전달한다(평문 문자열은 "Atlassian 문서여야 합니다" 오류). **필드 id 발견:** 설정 `outputFieldId`가 있으면 사용, 없으면 `getJiraIssueTypeMetaWithFields`로 `outputFieldName`(기본 "산출물") 매칭 `customfield_*`를 찾는다(못 찾으면 필드 기재는 건너뛰고 산출물을 코멘트/설명에만 남긴 뒤 보고 — 침묵 실패 금지). 커밋을 본문에만 남기지 않는다.
  - **수정 버전(fixVersions) 기재 ([3.5] 매칭 시):** 매칭된 릴리즈를 `additional_fields`에 `{ "fixVersions": [ { "id": "<versionId>" } ] }`로 넣는다(기존 이슈면 `editJiraIssue.fields`). **이름보다 id 우선**(allowedValues에서). 릴리즈 미정의·"매칭 안 함"이면 필드를 넣지 않는다. 대상은 설정 `fixVersionsTarget`(기본 Sub-task).
  - **부모 Story/Task 신규 생성**(흐름 3): `issueTypeName`을 결정 타입(Story|Task)으로, `parent`=상위 Epic 키(보통 `수행`)로 둔다. 인스턴스마다 Epic 연결 방식(parent vs epic link 커스텀필드)이 다를 수 있으니 `getJiraIssueTypeMetaWithFields`로 필드를 확인한다.
  - Story/Task 생성 시 시작일·종료일 필수. 종료일은 `additional_fields`의 `duedate`, 시작일은 인스턴스별 커스텀 필드이므로 `getJiraIssueTypeMetaWithFields`로 필드 id를 확인해 `additional_fields`에 넣는다. 날짜 값이 없으면 질문.
- **DoD 갱신 (기존 이슈 완료/진행 시 — 상태만 바꾸지 말 것):** 전이 전에 대상 이슈 description을 읽어, 이번 작업으로 **충족된 DoD 체크박스를 `- [ ]` → `- [x]`로 갱신**한다(`editJiraIssue`, `contentFormat: "markdown"`). 부분 완료면 충족분만 체크. description에 DoD가 없으면 `references/worklog-templates.md`의 What/Why/How/DoD 템플릿으로 보강 후 체크. **상태(Done) 전이만 하고 DoD를 미체크로 두지 않는다.**
- 전이: `getTransitionsForJiraIssue` → 매칭되는 transitionId로 `transitionJiraIssue`.
  - Sub-task Done 전이엔 산출물 링크(커밋/MR URL)가 **산출물(Output) 필드에 기재돼 있어야** 한다(위 생성/편집 단계). 필드에 없으면 차단하고 사용자에게 알린다(코멘트/설명 첨부는 보조). **+ DoD 체크 완료를 확인**(위 단계).
  - **우산/Phase 이슈**(하위가 여러 phase로 나뉜 경우): Done 대신 In Progress 유지 + 충족된 DoD만 체크 + 진행 코멘트.
  - Bug Deployed→해결방법 댓글, Verified→검증방법 댓글 필수(`addCommentToJiraIssue`).
  - 진행 업데이트·전이 댓글은 모두 comment 템플릿(자유서술 + **산출물** 링크)을 따른다. 산출물 링크가 없으면 "링크 없이 진행만 기록할까요?"를 1회 확인한다.
- 필요 시 `addWorklogToJiraIssue`로 작업 시간 기록.

### 6. 관련 Confluence 문서 역링크 (opt-in)
이슈 쓰기 완료 후, **이번 작업과 관련된 Confluence 문서가 이미 있으면** 그 링크를 Jira 코멘트로 첨부할지 제안한다. **자동 아님 — dry-run 승인 후 실행(안전장치 1). 문서를 못 찾으면 조용히 스킵(질문하지 않음).**
1. `searchConfluenceUsingCql`로 이번 작업 관련 문서를 검색한다.
   - 예: `text ~ "<요약 키워드>" AND type = page ORDER BY lastmodified DESC` (필요 시 `space = "<KEY>"` / `label` 로 좁힘).
   - 후보 0건이면 이 단계 종료(노이즈 금지).
2. 후보가 있으면 [문서 → 연결할 이슈] 매칭을 제시하고 dry-run 표 [이슈 | 추가될 코멘트]를 출력 → 승인 대기.
   - 어느 이슈에 달지 불명확하면 임의로 달지 말고 질문한다(안전장치 2). 같은 이슈에 같은 문서 링크가 이미 있으면 중복 첨부하지 않는다.
3. 승인 시 각 이슈에 표준 역링크 코멘트를 `addCommentToJiraIssue(contentFormat: "markdown")`로 작성한다.

**표준 역링크 코멘트 포맷** — dt-confluence-doc `§7`과 **완전히 동일한 공유 표준**. 두 스킬이 포맷을 갈라지지 않게 유지한다:
- `📄 관련 문서: [{문서 제목}]({Confluence URL}) ({타입} · {작성일})`

> 방향 구분: dt-confluence-doc는 **문서를 새로 쓸 때** Jira에 역링크(push), 본 스킬은 **작업 동기화 시 이미 있는 문서**를 찾아 링크(pull). 둘은 다른 시점에 독립 실행되며 중복이 아니다.

### 7. 상태 기록
- 동기화 성공 후 `HEAD` SHA를 `.dt-worklog.local.json`의 `lastSyncSha`에 저장(중복 방지).

## MCP 도구 매핑
| 동작 | 도구 |
|---|---|
| 내 정보/담당자 | `atlassianUserInfo` |
| cloudId | `getAccessibleAtlassianResources` |
| 프로젝트/이슈타입 | `getVisibleJiraProjects` |
| 부모/이슈 검색 | `searchJiraIssuesUsingJql` |
| 산출물 필드 id·릴리즈(fixVersions.allowedValues) 발견 | `getJiraIssueTypeMetaWithFields` |
| 관련 Confluence 문서 검색(역링크용) | `searchConfluenceUsingCql` |
| 이슈 생성 | `createJiraIssue` |
| 기존 이슈 필드 수정(산출물·DoD) | `editJiraIssue` |
| 가능 전이 조회 | `getTransitionsForJiraIssue` |
| 상태 전이 | `transitionJiraIssue` |
| 댓글 | `addCommentToJiraIssue` |
| 작업로그 | `addWorklogToJiraIssue` |

## 비범위
**이 스킬은 개발자(FE/BE)의 개발 작업 동기화 전용이다.** 다음은 다른 역할 소관이라 다루지 않는다:
- **디자인(UX/Visual) Sub-task** 및 디자인 Story/Task 관리(디자이너 소관).
- **QA 영역**: Bug의 Verified·Closed 전이, 결함 판정(Rejected/Reopened). 개발자가 닿는 Bug Deployed(해결방법 댓글)까지만.
- **PM/PL 영역**: **Epic 생성**(QA가 Space 생성 시 제공), 전체 Story 일정·우선순위 관리, 멀티 담당자 분배.
- Confluence **페이지 생성/수정**(문서 작성은 dt-confluence-doc), 고객사 Jira 이관.

역링크는 **Jira 코멘트 첨부만** — Confluence는 읽기(검색)만 하고, 양방향 자동 동기화·중복 코멘트 업서트는 비범위.
