# 공통 설정 스키마 (`.dt.json`)

팀과 프로젝트마다 달라야 하는 값을 한 파일에 둔다. 같은 `.dt.json`을 쓰는 사람은 같은 방식으로 플러그인을 돌린다. 팀이 프로젝트를 바꿔도 비슷한 결과가 나오게 하려는 장치다.

- **`.dt.json`**: 프로젝트 공통. 커밋한다.
- **`.dt.local.json`**: 개인 덮어쓰기. **커밋하지 않는다**(`.gitignore`에 넣는다). 예: 내 컴퓨터에서만 다른 모델을 쓸 때.
- **설정이 없으면 지금과 똑같이 돈다.** 아래 기본값이 곧 현행 동작이다.

읽는 법은 하나다. 공용 로더 `${CLAUDE_PLUGIN_ROOT}/scripts/lib/config.mjs`를 쓴다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/config.mjs" <projectRoot>
# → { "config": {...}, "warnings": [...], "sources": [".dt.json", ...] }
```

병합 순서는 기본값 → `.dt-pipeline.json`(옛 훅 설정) → `.dt.json` → `.dt.local.json`이다. 객체는 키 단위로 합치고, 배열과 값은 뒤에 온 것이 이긴다. 틀린 값과 모르는 키는 `warnings`에 남기고 기본값을 쓴다. 로더는 던지지 않는다. `warnings`가 있으면 조율자는 사용자에게 한 줄씩 보인다.

## 형식 버전

최상위 `"$schemaVersion": 1`은 설정 파일의 형식 버전이다(`docs/refs/compat-policy.md`). 키가 아니라 표에 없고, 로더는 경고 없이 넘긴다. 없으면 현재 형식으로 본다. 플러그인보다 큰 값이면 `/dt-migrate`가 "플러그인을 업데이트하라"고 알린다.

## 키

| 키 | 뜻 | 기본값 | 읽는 곳 |
|---|---|---|---|
| `hooks.enabled` | 마무리·시작 알림 훅을 켠다. `hooks` 섹션이 아예 없으면 훅은 꺼져 있다(opt-in) | `true`(섹션이 있을 때) | `hooks/scripts/lib/pipeline-state.mjs` |
| `hooks.commitThreshold` | 정리 안 된 커밋이 몇 개부터 마무리 루틴을 권할지. 1 이상 정수 | `1` | `hooks/scripts/lib/pipeline-state.mjs` |
| `hooks.startReminder` | main에서 구현을 시작하면 피처 브랜치를 권할지 | `true` | `hooks/scripts/lib/pipeline-state.mjs` |
| `team.execution` | 여러 단위 작업의 실행 방식. `ask`=시작할 때 한 번 묻는다 · `parallel` · `sequential`=묻지 않고 그 방식으로 | `"ask"` | `docs/orchestration-policy.md` |
| `team.models.planner` | 스펙·정의서·플랜·분석·집필·e2e 작성 에이전트의 모델. `opus`·`sonnet`·`haiku`·`fable` 또는 `null` | `null`(에이전트 파일의 `model`) | `docs/orchestration-policy.md` |
| `team.models.builder` | 구현 에이전트(fe-builder·be-builder)의 모델 | `null` | `docs/orchestration-policy.md` |
| `team.models.reviewer` | 판정 에이전트(reviewer·ko-writing-reviewer·auditor)의 모델 | `null` | `docs/orchestration-policy.md` |
| `team.locale` | 산출물 언어. 지금은 `ko`만 지원한다. 다른 값이면 경고하고 `ko`로 쓴다 | `"ko"` | `docs/orchestration-policy.md` |
| `decisions.sharedDir` | FE·BE 저장소가 나뉘었을 때 정의서가 있는 저장소의 결정 폴더(이 프로젝트 루트 기준 상대 경로, 예: `"../web/docs/decisions"`). 결정 읽기·다음 번호·override 근거 검사가 자기 폴더와 함께 본다. 폴더가 없으면(그 저장소만 받은 CI) 못 찾은 근거는 오류 대신 경고. 경로가 사람마다 다르면 `.dt.local.json`으로 덮는다 | `null`(자기 `docs/decisions/`만) | `scripts/decisions.mjs` |
| `tracker` | 작업 기록 트래커. `jira` · `github` · `linear` · `none`. 연동은 `jira`만 한다 — `github`·`linear`는 아직 "지원하지 않는다"고 알리고 `none`처럼 요약만 낸다. `none`은 아무 데도 쓰지 않고 정리한 작업을 마크다운으로만 보인다(`docs/refs/tracker-adapter.md`) | `"jira"` | `scripts/worklogConfig.mjs` |
| `wiki` | 위키. `confluence` · `markdown` · `notion` · `none`. 연동은 `confluence`만 한다 — `markdown`은 같은 템플릿으로 저장소 `docs/wiki/`에 쓰고, `notion`은 아직 "지원하지 않는다"고 알리며 `none`처럼, `none`은 본문을 대화에 마크다운으로만 보인다(`docs/refs/wiki-adapter.md`) | `"confluence"` | `scripts/wikiConfig.mjs` |
| `wrap.steps` | 마무리 루틴(`/dt-wrap`)의 단계와 순서. `commit`·`wiki`·`tracker` 중에서 고른다. 어댑터가 꺼진 단계(`wiki`가 `none`·`notion`, `tracker`가 `none`·`github`·`linear`)는 넣어 두어도 건너뛴다. Stop 훅 알림 문구도 이 단계로 만든다. 모르는 이름·중복은 경고하고 빼며, 남는 단계가 없으면 기본 순서를 쓴다 | `["commit", "wiki", "tracker"]` | `scripts/wrapState.mjs` |
| `gitFlow.baseBranch` | 피처 브랜치를 따고 합치는 기준 브랜치(예: `"develop"`). 훅의 시작 알림도 이 브랜치에서 뜬다 | `"main"` | `scripts/gitFlow.mjs` |
| `gitFlow.mergeStrategy` | `/dt-git finish`가 합치는 방식. `no-ff`=머지 커밋으로 모든 커밋 보존 · `squash`=커밋 하나로 합침 · `rebase`=리베이스 뒤 일직선(`--ff-only`) · `pr`=피처 브랜치를 push하고 PR을 연다(머지는 호스트에서) | `"no-ff"` | `scripts/gitFlow.mjs` |
| `gitFlow.branchPrefix` | `/dt-git start`에서 이름에 슬래시가 없을 때 한 번 제안할 접두어. `null`이면 제안하지 않는다 | `"feat/"` | `scripts/gitFlow.mjs` |
| `gitFlow.pushPolicy` | `push`=머지 뒤 기준 브랜치를 push(승인한 계획 안에서, fast-forward만) · `none`=push는 사람이 직접. `pr` 방식에서는 피처 브랜치만 push한다 | `"push"` | `scripts/gitFlow.mjs` |
| `team.requiredMcp` | 팀이 꼭 쓰는 MCP 서버 이름 목록(예: `"figma"`, `"atlassian"`). 그 MCP를 쓰는 스킬이 시작할 때 연결을 점검한다 | `[]` | `docs/orchestration-policy.md` |

에이전트가 어느 티어(`planner`·`builder`·`reviewer`)에 속하는지는 `scripts/lib/config.mjs`의 `AGENT_TIERS`가 정한다.

## 예시

```json
{
  "hooks": { "commitThreshold": 3 },
  "team": {
    "execution": "parallel",
    "models": { "planner": "opus", "builder": "sonnet", "reviewer": "opus" },
    "locale": "ko",
    "requiredMcp": ["figma", "atlassian"]
  },
  "decisions": { "sharedDir": "../web/docs/decisions" }
}
```

## 아직 없는 키

다음 키는 **그 값을 읽는 기능을 범용화할 때** 읽는 곳과 함께 넣는다. 읽는 곳 없이 먼저 적어 두면, 적혀 있는데 아무도 안 읽는 키가 생긴다.

- `uxSources` — M3

새 키를 넣을 때는 세 곳을 같이 바꾼다. 로더의 `DEFAULTS`와 검증, 위 표, 그리고 그 키를 실제로 읽는 코드나 스킬이다. 구조 테스트가 표와 로더가 어긋나거나 읽는 곳이 없는 키를 잡는다.

## 개인 상태 파일

`.dt-pipeline.local.json`은 설정이 아니라 상태다. `/dt-wrap`을 마칠 때 `lastWrapSha`(그때의 HEAD)를 남기고, Stop 훅은 이 값과 `.dt-worklog.local.json`의 `lastSyncSha` 중 더 최근 것부터 정리 안 된 커밋을 센다. 사람마다 다르므로 커밋하지 않는다(`/dt-wrap --init`이 `.gitignore`에 더한다).

## 기능별 설정은 따로 둔다

스택 규칙(`.dt-frontend.json`·`.dt-backend.json`), Jira(`.dt-worklog.json`)·Confluence(`.dt-confluence.json`) 연동, 가이드(`.dt-guide.json`), 핸드북(`.dt-handbook.json`) 설정은 그 기능만 쓰는 세부 설정이라 각자 파일에 둔다. `.dt.json`은 여러 스킬이 함께 쓰는 값만 담는다.
