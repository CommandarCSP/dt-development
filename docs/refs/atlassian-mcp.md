# Atlassian MCP 도구 대응표 (v1 · v2)

Jira·Confluence를 쓰는 스킬(dt-worklog-sync·dt-confluence-doc·dt-handbook·dt-spec의 Confluence 소스)은 **도구 이름을 본문에 박지 않고 이 표의 "하는 일" 이름으로 적는다.** 실제로 부를 도구는 이 표에서 찾는다. 공식 Atlassian MCP는 v1(`https://mcp.atlassian.com/v1/mcp`, 2027-03-01 종료)과 v2(`https://mcp.atlassian.com/v2/mcp`)의 도구 이름·인자가 다르다. 이름이 또 바뀌면 이 표만 고친다.

## 1. 어느 쪽에 연결됐나 — 시작할 때 한 번

세션 도구 목록을 보고 정한다. 스킬이 Atlassian을 처음 부르기 전에 한다.

| 도구 목록에 있는 것 | 판정 |
|---|---|
| `…__discover` 또는 `…__executeRead` | **v2** |
| `…__getTransitionsForJiraIssue`·`…__getConfluencePage` 같은 v1 이름 | **v1** |
| 둘 다 없음 | 연결 안 됨 — 그만두지 않고 선택지(원칙 10): ① 연결 안내(`claude mcp add --transport http -s user atlassian https://mcp.atlassian.com/v2/mcp` 뒤 `/mcp`에서 인증, 또는 claude.ai 커넥터) 후 이어서 ② Jira·Confluence 단계만 건너뛰고 나머지 진행(초안·미리보기를 파일로 남김) ③ 중단 |

**접두어**는 설정마다 다르다 — 직접 등록한 서버는 `mcp__atlassian__`, claude.ai 커넥터는 `mcp__claude_ai_Atlassian__`. 도구 목록에 실제로 있는 접두어를 쓴다. 아래 표는 접두어를 뺀 이름이다.

v2에서 "직접 도구"가 없는 일은 범용 실행기로 부른다: 읽기 `executeRead({ name, cloudId, inputs })`, 쓰기 `executeWrite({ name, cloudId, inputs })`. `name`은 아래 표의 연산 이름을 그대로 쓴다(모르면 `discover`로 찾는다 — 지어내지 않는다).

## 2. 대응표

### 공통
| 하는 일 | v1 | v2 | 인자·응답 차이 |
|---|---|---|---|
| `site.resources` (cloudId·site 확인) | `getAccessibleAtlassianResources` | `getAccessibleAtlassianResources` | 같다. v2는 `cloudId`에 사이트 호스트명(`<site>.atlassian.net`)도 받는다 |
| `user.me` (내 accountId) | `atlassianUserInfo` | `atlassianUserInfo` | 같다 |

### Jira
| 하는 일 | v1 | v2 | 인자·응답 차이 |
|---|---|---|---|
| `jira.projects` (보이는 프로젝트) | `getVisibleJiraProjects` | `executeRead` → `listJiraProjects` | v2 인자 `action`·`maxResults`·`startAt`·`expand`(`issueTypes` 등). 응답이 `{ data: { values } }`로 한 겹 감싸인다 — `buildProjectCandidates.mjs`가 두 모양을 다 받는다 |
| `jira.search` (JQL) | `searchJiraIssuesUsingJql` | `searchJiraIssuesUsingJql` | v2 응답도 `{ data: { issues } }`로 감싸인다. 페이지는 `nextPageToken`·`isLast` |
| `jira.issue.get` | `getJiraIssue` | `getJiraIssue` | 같다 |
| `jira.issue.create` | `createJiraIssue` | `createJiraIssue` | **이슈 유형 인자: v1 `issueTypeName` → v2 `issueType`.** 세션에 옛 스키마가 남아 직접 호출이 `issueType: Required`로 실패하면 `executeWrite({ name: "createJiraIssue", inputs: { projectKey, issueType, summary, description, parent, … } })`로 부른다. 커스텀 필드는 v2도 `additional_fields` |
| `jira.issue.edit` | `editJiraIssue` | `editJiraIssue` | 같다(`fields`) |
| `jira.issueTypes` (프로젝트의 이슈 유형) | `getJiraProjectIssueTypesMetadata` | `executeRead` → `listJiraProjectIssueTypesMetadata` | v2 인자 `projectIdOrKey` |
| `jira.fieldMeta` (이슈 유형의 필드·허용값) | `getJiraIssueTypeMetaWithFields` | `executeRead` → `getJiraIssueTypeMetaWithFields` | v2는 `issueTypeId` 필수(`jira.issueTypes`로 먼저 얻는다), 기본은 필수 필드만 — 산출물 필드·`fixVersions`를 찾으려면 `requiredFieldsOnly: false` |
| `jira.versions` (릴리즈 목록) | 없음 — `jira.fieldMeta`의 `fixVersions.allowedValues` | `executeRead` → `getJiraProjectVersions` | v2는 전용 연산이 있다. v1 경로(`allowedValues`)도 v2에서 그대로 된다. 릴리즈를 **만드는 것**(`manageJiraProjectVersion`)은 스킬이 하지 않는다 — 사람이 만든다(`release-matching.md`) |
| `jira.transitions` (지금 가능한 전이) | `getTransitionsForJiraIssue` | `executeRead` → `listJiraIssueTransitions` | 응답의 전이 id를 `jira.transition`에 넘긴다. 전이 이름과 도착 상태는 다른 필드다 — 도착 상태로 고른다 |
| `jira.transition` | `transitionJiraIssue` | `transitionJiraIssue` | **v1 `transition: { id }` → v2 `transitionId: "<id>"`.** v2는 도착한 상태를 돌려준다(다시 읽을 필요 없음) |
| `jira.comment` | `addCommentToJiraIssue` | `addOrEditJiraIssueComment` | 본문 `commentBody`·`contentFormat: "markdown"`은 같다. v2는 `commentId`를 주면 수정. **markdown의 `- [ ]`는 체크박스가 되지 않는다** — 체크박스는 `contentFormat: "html"`의 task list(`<ul data-type="task-list">`)로 쓴다(설명·댓글 같음) |
| `jira.remoteLinks` (이슈의 웹 링크 목록) | (없음) | `executeRead` → `listJiraIssueRemoteIssueLinks` | `issueIdOrKey`. 달기 전에 같은 `url`이 있는지 본다 |
| `jira.remoteLink` (이슈에 웹 링크 달기) | (없음 — 댓글로 대신) | `executeWrite` → `createJiraIssueRemoteIssueLink` | `issueIdOrKey`·`url`(http(s) 절대 주소)·`title`·`summary`·`relationship`. 같은 `url`을 두 번 넣으면 링크가 둘이 되고 지우는 도구는 없다 — `jira.remoteLinks`로 먼저 확인한다. 쓰는 곳: `dt-confluence-doc` §8 |
| `jira.worklog` | `addWorklogToJiraIssue` | `executeWrite` → `addOrEditJiraIssueWorklog` | `timeSpent`(예 `2h 30m`)·`started`(ISO 8601)·`comment` |

### Confluence
| 하는 일 | v1 | v2 | 인자·응답 차이 |
|---|---|---|---|
| `confluence.spaces` (공간 목록·키→id) | `getConfluenceSpaces` | `executeRead` → `listConfluenceSpaces` | v2 인자 `keys`(키로 바로 찾기)·`limit`·`cursor` |
| `confluence.pages` (공간 안 페이지) | `getPagesInConfluenceSpace` | `executeRead` → `listConfluenceContent` | v2 인자 `type: "page"`·`spaceId`(숫자) |
| `confluence.search` (CQL) | `searchConfluenceUsingCql` | `searchConfluence` | 인자 `cql`·`limit`·`cursor` |
| `confluence.get` (페이지 읽기 — URL·id) | `getConfluencePage`·`fetch` | `getConfluenceContent` | v2 `content_url` 또는 `content_id`, 본문이 필요하면 `detail: "full"`·`content_format: "markdown"\|"html"` |
| `confluence.create` | `createConfluencePage(spaceId, parentId, title, body, contentFormat)` | `createConfluenceContent` | **모양이 다르다:** `parent: { spaceId, parentContentId? }`·`contentType: "page"`·`title`·`body: { format: "html", value }`. 쓰기 전에 `executeRead` → `getContentFormatGuide({ toolName: "createConfluencePage" })`(Confluence HTML 규칙)와 `getConfluenceSpace({ spaceIdOrKey })`(공간 지침)를 작업당 한 번 읽는다 |
| `confluence.update` | `updateConfluencePage` | `updateConfluenceContent` | v2는 `contentId`·`body`(또는 `edits`)·**`snapshotToken` 필수** — 먼저 `getConfluenceContent(detail: "full")`로 읽어 받은 토큰을 넘긴다. `dryRun: true`로 미리보기 가능 |
| `confluence.labels` (라벨 붙이기) | (전용 도구 없음 — 본문 끝에 "라벨: …"을 남기고 보고) | `executeWrite` → `addLabelsToConfluenceContent` | `contentId`·`labels: [{ name }]`(공백 없는 이름) |

## 3. 명령의 `allowed-tools`

명령 머리말 `allowed-tools`에는 그 스킬이 쓰는 **v1·v2 이름을 둘 다** 적는다(종료일 전까지 둘 다 돌아야 한다). 읽기 실행기 `executeRead`·`discover`는 적는다. **`executeWrite`는 적지 않는다** — 모든 제품의 쓰기를 대신하는 범용 실행기라 미리 허락하는 범위가 너무 넓다. 그 경로의 쓰기(v2 워크로그)는 하네스가 한 번 더 확인한다. 구조 테스트가 이 규칙을 검사한다.
