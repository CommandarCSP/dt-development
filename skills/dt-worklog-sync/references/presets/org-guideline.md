# 프리셋 `org-guideline` — 사내 Jira 가이드라인 v1.0 재현

**고른 팀만 쓰는 선택 프리셋이다.** 기본은 `basic`(TP-002)이다. `.dt-worklog.json`에 `"preset": "org-guideline"`을 적으면 스킬이 아래 규칙을 강제한다. 기계로 읽는 값(이슈 유형 이름·전이·필드·필수 날짜)은 `scripts/worklogConfig.mjs`의 `PRESETS['org-guideline']`이 원본이고, 이 문서는 그 규칙의 문장이다.

`preset` 없이 옛 설정 키(`issueTypeNames`·`transitionMap`·`outputFieldName`·`outputFieldId`)만 있는 설정도 이 프리셋으로 본다. 옛 위저드가 만든 설정이라, 이미 쓰던 팀의 동작을 바꾸지 않기 위해서다.

출처: 사내 "JIRA 사용자 가이드라인 v1.0".

## 이슈 타입 (Epic은 스킬이 생성하지 않음 — QA팀 관리)
- 스토리(Story): 화면 단위 디자인/개발. 시작·종료일 필수.
- 작업(Task): 화면 외 협업 업무. 시작·종료일 필수.
- 버그(Bug): 기능 결함. 시작·종료일 불필요. 제한 전이.
- 하위 작업(Sub-task): 개인 실제 업무 단위. 시작·종료일 불필요. **실무자의 기본 단위.**

## 강제 룰
1. 실무자는 Sub-task 기준으로 일한다 → 기본 생성 단위 = Sub-task (부모 Story/Task 필요).
2. Sub-task 크기 = 1일(최대 3일). Todo 수준 과세분화 금지.
   - O 예시: "로그인 기능 설계", "홈 화면 구현"
   - X 예시: "버튼 색상 변경", "비밀번호 오류 문구 수정", "로그 확인" → 개별 이슈로 만들지 않음
3. 3일 초과 → 동일 이름 "(1)", "(2)" 차수 분리.
4. 담당자(Assignee) 필수 — 비워두지 않음. 기본값 = 인증된 나.
5. 담당자별로 Sub-task 분리 — 내 작업만 내 Sub-task로.
6. 구두/메신저 요청도 Jira 등록 (수동 메모 소스).
7. **Sub-task 완료(Done) 시 산출물 링크(커밋/MR/테스트결과) 필수.** 추적 불가 이슈는 Done 금지.
8. 진행 상황에 맞춰 Status 즉시 업데이트.

## 상태(Status) 워크플로우
- Sub-task: Backlog → Todo → In Progress → (Resolved/Feedback) → Done
- Story: 파트별 — UX 진행/완료, GUI 진행/완료, **개발 진행/개발 완료**, QA 진행/완료, Done
- Bug: Backlog → Open → Assign → In Progress → Integration → Deployed → Verified → Done
  - Rejected → (QA) Closed / Reopened → 담당자 재지정 후 Assign부터
  - **Deployed 전이 시 해결 방법을 댓글로 필수 기록**
  - **Verified 전이 시 검증 방법을 댓글로 필수 기록**

## 컴포넌트
UX / Visual / Dev / Interaction — 작업 파트 구분. FE/BE 개발 작업은 보통 **Dev**.

## 이슈 유형 결정 (FAQ 3 — 부모 생성 시 적용)
- **화면 단위 디자인/개발** → **Story** (예: "A 화면", "기능 A API 구현")
- **화면 외 협업/일반 개발 작업** → **Task** (예: 요구사항 분석, 설계, 인프라, 배포, 변경 이력)
- 디자인/개발 기능의 **결함** → **Bug**
- 개인이 수행할 **실제 업무 단위** → **Sub-task** (Story/Task/Bug 아래)

## Epic 구조 (QA 제공 — 스킬은 생성하지 않음)
QA팀이 Space 생성 시 기본 Epic을 만들어 둔다: **관리 / 수행 / 검수 / 변경 이력 / 배포 및 오픈**.
개발 작업의 Story/Task는 보통 **`수행` Epic**(BE는 "수행 (BE)") 아래에 둔다. 운영/변경은 `변경 이력`, 배포 작업은 `배포 및 오픈`.

## Story 공유 규칙
스토리는 **화면 기준으로 프로젝트 참여 인원이 함께 쓰는** 유형이다. **같은 화면의 Story를 UX·GUI·개발용으로 따로 만들지 않는다.** 이미 그 화면 Story가 있으면 개발 Sub-task를 그 아래에 단다(개발 진행/개발 완료는 Story의 파트별 상태로 표현).

## 개발(Dev) 파트 사례 (PDF — 부모 타입 판단 참고)
**Task 유형(화면 외 개발 작업)** + 하위 Sub-task 예:
- 요구사항 분석 → 기획서 분석
- 설계 → FE 설계 / API 설계 / DB 스키마 설계 / 공통 컴포넌트 구현
- 인프라 구성 → 인프라 설계 / 인프라 구성
- 배포 및 오픈 → 배포
- 변경 이력 → "YY-MM-DD 고객사 기능 변경 요청" → A1 API 수정

**Story 유형(화면/기능 단위 개발)** + 하위 Sub-task 예:
- A 화면 / B 화면 → 세부 화면 구현
- (BE) 기능 A API 구현 → A1 API 구현 / A2 API 구현

## 담당자 (FAQ 5)
담당자는 비워두지 않는다. 미정이면 PM/PL이 임시 담당 후 확정 시 변경 — **단, 본 스킬은 항상 인증된 나를 담당자로 둔다**(내 개발 작업 동기화 전용).

## 본 스킬의 적용 범위 (개발자)
위 룰 중 **개발자가 자기 작업을 Sub-task로 기록**하는 데 필요한 부분만 강제한다. 디자인(UX/Visual) Story·Sub-task, QA의 Bug 검증(Verified/Closed)·결함 판정, PM의 Epic/전체 Story 관리는 본 스킬 범위 밖이다(다른 역할 가이드).

## 산출물(Output) 커스텀 필드 입력 규칙

Jira Sub-task(및 Story/Task)의 세부사항에 **산출물(Output)** 커스텀 필드가 있다. 멀티라인 텍스트 필드로, 해당 업무의 산출물을 **확인할 수 있는 파일명 또는 URL**을 자유롭게 받는다. 이 문서가 그 입력 규칙의 SOT다.

> **필드 식별(인스턴스별):** 필드 id는 Jira 인스턴스마다 다르다. 설정(`.dt-worklog.json`)의 `outputFieldId`가 있으면 그것을, 없으면 `jira.fieldMeta`로 이름(`outputFieldName`, 기본 `"산출물"`)에 매칭되는 `customfield_*` id를 찾아 쓴다. 못 찾으면 산출물은 코멘트/설명에만 남기고 필드 기재는 건너뛴다(침묵 실패 금지 — 보고).
> - ACME SAP 인스턴스 기준값: `customfield_10731`.
>
> **값 형식 — ADF(리치텍스트) 필수:** 이 필드는 평문 문자열이 아니라 **Atlassian 문서(ADF)** 값을 요구한다(`{"type":"string"...:textarea}` 스키마여도 실제로는 리치텍스트). 평문 `"url1\nurl2"`를 넣으면 `"값은 Atlassian 문서여야 합니다"` 오류가 난다. **URL 한 줄 = paragraph 하나**로 ADF 문서를 구성해 `additional_fields`(생성) 또는 `jira.issue.edit.fields`(수정)에 객체로 전달한다:
> ```json
> { "customfield_10731": { "type": "doc", "version": 1, "content": [
>   { "type": "paragraph", "content": [ { "type": "text", "text": "https://git.example.com/.../-/commit/<sha> (merge)" } ] },
>   { "type": "paragraph", "content": [ { "type": "text", "text": "https://git.example.com/.../-/commit/<sha> (Part A)" } ] }
> ] } }
> ```
> URL은 평문 text로 두면 Jira가 자동 링크화한다(별도 link mark 불필요). 필드 발견 시 `schema.custom`이 다른 타입(예: `url`·`labels`)이면 그 타입에 맞춰 전달한다.

### 입력 대상
산출물을 **확인할 수 있는 파일명 또는 URL**을 입력한다.

#### 1. 파일인 경우
첨부 파일(Attachment)에 업로드한 뒤, **첨부한 파일명**을 Output에 적는다.
```
요구사항정의서_v1.2.docx
UI_Design.fig
Test_Result_20260721.xlsx
```

#### 2. URL인 경우
산출물을 확인할 수 있는 URL을 적는다:
- Figma 작업 URL
- **Git Commit 또는 Merge Request URL**
- Google Docs / Sheets / Slides URL
- 구현된 서비스(웹사이트) URL
- 기타 산출물 확인 URL

#### 3. 여러 개인 경우
파일명·URL을 **한 줄에 하나씩** 모두 기재한다(멀티라인). 파일명+URL 혼합도 가능.
```
UI_Design.fig
https://www.figma.com/...
https://git.example.com/...
https://docs.google.com/...
```

### 개발 작업(dt-worklog-sync) 적용 규칙
개발자의 Sub-task는 산출물이 보통 **Git Commit / Merge Request URL**이다. 따라서:

- **커밋을 코멘트·설명 본문에만 남기지 않는다** — 커밋/MR의 **GitLab URL 자체를 산출물 필드에 기재**한다(이 문서 §2). 본문 DoD·코멘트의 산출물 링크는 보조.
- **GitLab 웹 URL 도출** — `node "${CLAUDE_PLUGIN_ROOT}/scripts/gitWebUrl.mjs" commit <sha>`가 만든다(이 프리셋은 `gitHost: gitlab`). 설정 `gitWebBaseUrl`이 있으면 그것을, 없으면 `git remote get-url origin`에서 도출한다:
  - `ssh://git@host:PORT/group/repo.git` → 웹 베이스 `https://host/group/repo`
  - 커밋: `<웹베이스>/-/commit/<sha>` · MR: `<웹베이스>/-/merge_requests/<iid>` (GitLab 규약)
  - 예: `ssh://git@git.example.com:14022/rnd_dev/dt_development.git` → `https://git.example.com/rnd_dev/dt_development/-/commit/559dba4`
- **여러 커밋/머지**는 대표 산출물 위주로 기재(작업 단위의 머지 커밋 URL이 있으면 그것을 우선, 필요 시 주요 파트 커밋 URL을 줄바꿈으로 나열). 사소한 커밋을 전부 나열하지 않는다(가이드라인 1~3일 단위 정신).
- 파일 산출물(설계 문서·테스트 결과 등)이 있으면 첨부 후 **파일명**을 같은 필드에 함께 줄바꿈으로 적는다.
- 산출물이 하나도 없으면(예: 순수 조사) 필드를 비우고 그 사유를 코멘트에 남긴다. **Done 전이는 산출물 링크가 필수**(이 프리셋의 `close.need: output`)이므로, 개발 Sub-task Done 시 최소 1개의 커밋/MR URL이 이 필드에 있어야 한다.
