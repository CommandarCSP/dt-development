# 산출물(Output) 커스텀 필드 입력 규칙 (ACME)

Jira Sub-task(및 Story/Task)의 세부사항에 **산출물(Output)** 커스텀 필드가 있다. 멀티라인 텍스트 필드로, 해당 업무의 산출물을 **확인할 수 있는 파일명 또는 URL**을 자유롭게 받는다. 이 문서가 그 입력 규칙의 SOT다.

> **필드 식별(인스턴스별):** 필드 id는 Jira 인스턴스마다 다르다. 설정(`.dt-worklog.json`)의 `outputFieldId`가 있으면 그것을, 없으면 `getJiraIssueTypeMetaWithFields`로 이름(`outputFieldName`, 기본 `"산출물"`)에 매칭되는 `customfield_*` id를 찾아 쓴다. 못 찾으면 산출물은 코멘트/설명에만 남기고 필드 기재는 건너뛴다(침묵 실패 금지 — 보고).
> - id는 인스턴스마다 다르다 — 위 탐색으로 못 찾을 때만 임시로 값을 넣어 확인하는 예시일 뿐 고정값이 아니다(예: `customfield_10731`).
>
> **값 형식 — ADF(리치텍스트) 필수:** 이 필드는 평문 문자열이 아니라 **Atlassian 문서(ADF)** 값을 요구한다(`{"type":"string"...:textarea}` 스키마여도 실제로는 리치텍스트). 평문 `"url1\nurl2"`를 넣으면 `"값은 Atlassian 문서여야 합니다"` 오류가 난다. **URL 한 줄 = paragraph 하나**로 ADF 문서를 구성해 `additional_fields`(생성) 또는 `editJiraIssue.fields`(수정)에 객체로 전달한다:
> ```json
> { "customfield_10731": { "type": "doc", "version": 1, "content": [
>   { "type": "paragraph", "content": [ { "type": "text", "text": "https://git.example.com/.../-/commit/<sha> (merge)" } ] },
>   { "type": "paragraph", "content": [ { "type": "text", "text": "https://git.example.com/.../-/commit/<sha> (Part A)" } ] }
> ] } }
> ```
> URL은 평문 text로 두면 Jira가 자동 링크화한다(별도 link mark 불필요). 필드 발견 시 `schema.custom`이 다른 타입(예: `url`·`labels`)이면 그 타입에 맞춰 전달한다.

## 입력 대상
산출물을 **확인할 수 있는 파일명 또는 URL**을 입력한다.

### 1. 파일인 경우
첨부 파일(Attachment)에 업로드한 뒤, **첨부한 파일명**을 Output에 적는다.
```
요구사항정의서_v1.2.docx
UI_Design.fig
Test_Result_20260721.xlsx
```

### 2. URL인 경우
산출물을 확인할 수 있는 URL을 적는다:
- Figma 작업 URL
- **Git Commit 또는 Merge Request URL**
- Google Docs / Sheets / Slides URL
- 구현된 서비스(웹사이트) URL
- 기타 산출물 확인 URL

### 3. 여러 개인 경우
파일명·URL을 **한 줄에 하나씩** 모두 기재한다(멀티라인). 파일명+URL 혼합도 가능.
```
UI_Design.fig
https://www.figma.com/...
https://git.example.com/...
https://docs.google.com/...
```

## 개발 작업(dt-worklog-sync) 적용 규칙
개발자의 Sub-task는 산출물이 보통 **Git Commit / Merge Request URL**이다. 따라서:

- **커밋을 코멘트·설명 본문에만 남기지 않는다** — 커밋/MR의 **GitLab URL 자체를 산출물 필드에 기재**한다(이 문서 §2). 본문 DoD·코멘트의 산출물 링크는 보조.
- **GitLab 웹 URL 도출** — 설정 `gitWebBaseUrl`이 있으면 그것을, 없으면 `git remote get-url origin`에서 도출한다:
  - `ssh://git@host:PORT/group/repo.git` → 웹 베이스 `https://host/group/repo`
  - 커밋: `<웹베이스>/-/commit/<sha>` · MR: `<웹베이스>/-/merge_requests/<iid>` (GitLab 규약)
  - 예: `ssh://git@git.example.com:22/your-group/your-repo.git` → `https://git.example.com/your-group/your-repo/-/commit/559dba4`
- **여러 커밋/머지**는 대표 산출물 위주로 기재(작업 단위의 머지 커밋 URL이 있으면 그것을 우선, 필요 시 주요 파트 커밋 URL을 줄바꿈으로 나열). 사소한 커밋을 전부 나열하지 않는다(가이드라인 1~3일 단위 정신).
- 파일 산출물(설계 문서·테스트 결과 등)이 있으면 첨부 후 **파일명**을 같은 필드에 함께 줄바꿈으로 적는다.
- 산출물이 하나도 없으면(예: 순수 조사) 필드를 비우고 그 사유를 코멘트에 남긴다. **Done 전이는 산출물 링크가 필수**(안전장치 3)이므로, 개발 Sub-task Done 시 최소 1개의 커밋/MR URL이 이 필드에 있어야 한다.
