# 트래커 어댑터

작업 기록 스킬(`dt-worklog-sync`)과 감사(`dt-audit`)·핸드북(`dt-handbook`)이 트래커에 하는 일을 한 목록으로 둔다. 스킬 본문은 트래커 도구 이름 대신 이 "하는 일" 이름으로 적는다. 어떤 트래커를 쓰는지는 공통 설정 `.dt.json`의 `tracker`다(`docs/refs/config-schema.md`). 기록 규칙(무엇을 어떤 템플릿으로)은 트래커와 상관없이 `docs/policies/TP-002-task-records.md`와 프리셋이 정한다.

## 1. 지원 상태

| `tracker` | 상태 | 하는 일 |
|---|---|---|
| `jira` (기본) | 연동 | 아래 표의 하는 일을 Atlassian MCP 도구로 한다 — 이름·인자는 `docs/refs/atlassian-mcp.md`(v1·v2) |
| `github` | 스텁 | "아직 연동하지 않는다"고 알리고 `none`처럼 동작한다 |
| `linear` | 스텁 | 위와 같다 |
| `none` | 쓰지 않음 | 수집·요약까지만 하고, 정리한 작업을 TP-002 템플릿 그대로 마크다운으로 보인다. 사람이 원하는 곳에 붙인다. `lastSyncSha`는 사람이 "기록했다"고 확인했을 때만 저장한다. `/dt-wrap`에서는 트래커 단계 자체를 건너뛰고, 훅은 루틴이 남기는 `lastWrapSha`로 조용해진다 |

스텁 트래커를 연동하려면 아래 표의 하는 일마다 그 트래커의 도구를 대응시키고, 이 표의 상태를 바꾼다. 스킬 본문은 고치지 않는다.

## 2. 하는 일

| 하는 일 | 뜻 | Jira | GitHub(예정) | Linear(예정) |
|---|---|---|---|---|
| `user.me` | 인증된 나(담당자) | `user.me` | 인증 사용자 | viewer |
| `site.resources` | 사이트 식별 | `site.resources`(cloudId) | 저장소 owner/name | 팀 |
| `projects` | 기록할 프로젝트 목록 | `jira.projects` | 저장소 | 팀·프로젝트 |
| `search` | 이슈 찾기 | `jira.search`(JQL) | 이슈 검색 | 이슈 필터 |
| `fieldMeta` | 이슈 유형·필드·릴리즈 후보 | `jira.fieldMeta` | 라벨·마일스톤 | 라벨·사이클 |
| `issue.read` | 이슈 하나 읽기(제목·상태·설명) — 감사가 후속 기록의 진행 상태를 볼 때 | `jira.issue.get` | 이슈 조회 | 이슈 조회 |
| `issue.create` | 이슈 만들기 | `jira.issue.create` | 이슈 생성 | 이슈 생성 |
| `issue.edit` | 설명·필드 고치기(완료 조건 체크) | `jira.issue.edit` | 이슈 수정 | 이슈 수정 |
| `transitions` · `transition` | 가능한 상태 전이 · 전이 | `jira.transitions` · `jira.transition` | 열기·닫기 | 상태 변경 |
| `comment` | 진행·마무리 댓글 | `jira.comment` | 이슈 댓글 | 댓글 |
| `issue.link.web` | 이슈에 문서 링크 달기(문서 → 이슈 역링크). 같은 주소가 있으면 건너뛴다 | `jira.remoteLinks` · `jira.remoteLink` | 이슈 본문·댓글에 링크 | 첨부 링크 |
| `worklog` | 작업 시간(사람이 말했을 때만) | `jira.worklog` | — | — |
| `wiki.search` | 관련 문서 찾기(역링크) | `confluence.search` | — | — |

## 3. 계층 대응

TP-002 §1의 표와 같다: 결과 묶음(Jira Epic · GitHub Milestone/부모 이슈 · Linear Project), 기본 단위(Story·Task·Bug · Issue+라벨 · Issue), 나눈 일(Sub-task · Sub-issue · Sub-issue).
