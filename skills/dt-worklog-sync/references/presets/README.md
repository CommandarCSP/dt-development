# 작업 기록 프리셋과 설정 키

`dt-worklog-sync`는 조직마다 다른 규칙을 프리셋으로 고른다. 설정은 아래 순서로 합쳐진다: 프리셋 → 팀 `.dt-worklog.json`(커밋) → 개인 `.dt-worklog.local.json`(커밋하지 않음). 합친 결과는 아래 명령으로 본다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/worklogConfig.mjs" --project . --json
```

| 프리셋 | 쓰는 곳 | 문서 |
|---|---|---|
| `basic` (기본) | 일반 프로젝트. Story·Task·Bug 단위, Sub-task 선택, 한 주 안, 마무리 댓글에 산출물이나 결정 사항 | `basic.md` · 정책 `docs/policies/TP-002-task-records.md` |
| `org-guideline` | 사내 가이드라인 v1.0을 쓰는 팀. Sub-task 강제, 1~3일, `수행` Epic, 날짜·산출물 필드·릴리즈 필수 | `org-guideline.md` |

**`preset`을 고르는 순서**: 설정의 `preset`이 먼저다. 없는데 옛 키(`issueTypeNames`·`transitionMap`·`outputFieldName`·`outputFieldId`)가 있으면 `org-guideline`으로 보고 경고한다. 그것도 없으면 `basic`이다.

## 키

| 키 | 뜻 | `basic` | `org-guideline` |
|---|---|---|---|
| `preset` | 프리셋 이름 | — | — |
| `site` · `cloudId` · `defaultProjectKey` | 트래커 사이트·프로젝트(위저드가 채운다) | | |
| `issueTypes.<종류>` | 이슈 유형 이름 후보(앞에서부터 프로젝트 유형과 맞춘다). 종류: `epic`·`story`·`task`·`bug`·`subtask` | 영어·한글 이름 | 한글 이름 먼저 |
| `unit` | 기록의 기본 단위 | `["story","task","bug"]` | `["subtask"]` |
| `subtask` | `optional`(나눌 때만) · `required`(늘 Sub-task로) | `optional` | `required` |
| `transitions.<종류|default>.<동작>` | 전이 이름 후보 | `default.start`·`default.done` | Sub-task·Story 파트별·Bug Deployed/Verified |
| `epic` | `{ required, default }` — 스킬은 Epic을 만들지 않는다 | 선택 | 필수, 기본 `수행` |
| `size` | 묶음 크기 기준(일) | `maxDays: 5` | `1~3`, 넘으면 `(n)` 차수 |
| `requiredDates` | 시작·종료일이 필수인 종류 | `[]` | `["story","task"]` |
| `outputField` | 산출물 커스텀 필드 `{ name, id }` 또는 `null`(댓글 본문에만) | `null` | `{ name: "산출물" }` |
| `releases` | 수정 버전: `required` · `optional` · `off` | `optional` | `required` |
| `close.need` | 마무리 댓글에 꼭 있어야 할 것: `output` · `decision` · `outputOrDecision` | `outputOrDecision` | `output` |
| `bugComments` | Bug 전이별 필수 댓글 | 없음 | Deployed=해결 방법 · Verified=검증 방법 |
| `gitHost` | 커밋·PR 주소 형식: `github` · `gitlab` · `bitbucket` · `null`(호스트 이름으로 감지) | `null` | `gitlab` |
| `gitWebBaseUrl` | 리모트와 다른 웹 주소일 때만 | | |
| `issueKeyPattern` | 이슈 키 정규식 | | |
| `lastSyncSha` | (개인 파일) 마지막으로 기록한 커밋 | | |

옛 키는 한 minor 동안 함께 받는다(`docs/refs/compat-policy.md` §4): `issueTypeNames` → `issueTypes`, `transitionMap` → `transitions`, `outputFieldName`·`outputFieldId` → `outputField`. 프리셋 값을 팀에 맞게 바꾸려면 같은 키를 `.dt-worklog.json`에 적는다(`issueTypes`·`transitions`는 종류 단위로 합치고, 나머지는 통째로 바꾼다).

트래커 자체는 공통 설정 `.dt.json`의 `tracker`다(`docs/refs/tracker-adapter.md`).
