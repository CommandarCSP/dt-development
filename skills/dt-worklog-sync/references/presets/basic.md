# 프리셋 `basic` — 기본 작업 기록 규칙

`.dt-worklog.json`에 `preset`이 없으면 이 프리셋이다(옛 설정 키가 있는 경우는 `org-guideline` — `README.md`). 정책 원본은 `${CLAUDE_PLUGIN_ROOT}/docs/policies/TP-002-task-records.md`이다. 기계로 읽는 값은 `scripts/worklogConfig.mjs`의 `PRESETS.basic`이 원본이다. 이 문서는 스킬이 따를 규칙을 흐름 순서로 적는다.

## 기록 단위 (흐름 2·3)

- **Story · Task · Bug**가 기록 단위다. 담당자 한 명이 대략 **한 주 안**에 끝낼 크기로 묶는다. 커밋 하나에 이슈 하나를 맞추지 않는다.
  - 사용자에게 보이는 기능(화면·API) → **Story**
  - 보이지 않는 기술·운영 작업(설계·인프라·리팩터·배포·조사) → **Task**
  - 결함 → **Bug**
- 한 주를 넘을 일은 둘 이상으로 나누거나, Epic 하나로 올리고 그 아래에 둔다. 나눌지는 사람에게 묻는다.
- **사소한 변경**은 이슈로 만들지 않는다. 관련 이슈에 진행 댓글로 남긴다. 예: 문구 수정, 색 바꾸기, 로그 확인.
- **Sub-task는 만들지 않는 것이 기본이다.** 한 이슈를 여러 사람이 나눠 할 때만 쓴다. 혼자 하는 단계는 설명의 완료 조건 체크박스로 둔다. 이미 있는 이슈의 일부만 내가 한다면 Sub-task를 제안할 수 있다(사람이 고른다).

## 부모와 Epic (흐름 3)

- **이미 있는 이슈를 먼저 찾는다.** 같은 작업의 Story·Task·Bug가 있으면 새로 만들지 않고 거기에 댓글을 단다.
- **Epic은 있으면 고른다.** 맞는 Epic 후보를 보이고 사람이 고른다. "Epic 없이"도 선택지에 넣는다. 스킬은 Epic을 만들지 않는다.
- 의존 관계는 계층이 아니라 이슈 링크(blocks · relates to)로 제안한다.
- 날짜·추정은 받지 않는다(`requiredDates: []`).

## 릴리즈 (흐름 3.5)

`releases: optional`이다. `references/release-matching.md`의 "프리셋별 적용" 절을 따른다. 프로젝트에 릴리즈가 있으면 고르게 하고, 없으면 dry-run 표에 "릴리즈 없음(프로젝트에 없음)"으로 적고 넘어간다.

## 본문과 댓글 (흐름 5)

`references/worklog-templates.md`의 **basic** 절이다: 설명, 진행 댓글, 마무리 댓글.

- 산출물(PR·커밋·문서·배포 URL·테스트 결과)은 **댓글 본문**에 적는다. 커스텀 필드는 쓰지 않는다(`outputField: null`). 팀이 필드를 쓰려면 `.dt-worklog.json`에 `"outputField": { "name": "<필드 이름>" }`을 더한다. 그러면 댓글과 함께 그 필드에도 쓴다.
- 커밋·PR 주소는 `scripts/gitWebUrl.mjs`가 만든다. 호스트 종류를 모르면 사람에게 한 번 묻고 `gitHost`로 적는다.

## 마무리 (흐름 5 — Done 전이)

1. 마무리 댓글을 쓴다. **결과**가 있어야 하고, **산출물이나 결정 사항이 적어도 하나** 있어야 한다(`close.need: outputOrDecision`).
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/worklogConfig.mjs" check-close <댓글 파일>`이 통과해야 Done으로 넘긴다. 막히면 빠진 항목을 사람에게 묻는다.
3. 설명의 완료 조건 체크박스를 이번 작업에 맞게 갱신한다. 못 채운 항목은 마무리 댓글의 "완료 조건"에 이유를 적는다.
4. 오래 갈 결정(다른 작업에도 걸리는 결정)이면 PD 초안을 제안한다(`/dt-decision`). 마무리 댓글에는 그 링크를 둔다.

## 전이

`transitions.default`의 `start`(진행 시작)·`done`(완료) 이름 후보를 실제 가능 전이와 맞춘다. 없으면 사람에게 고르게 한다. Bug도 같은 두 전이만 쓴다. 단계별 필수 댓글은 없다.
