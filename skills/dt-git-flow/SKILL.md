---
name: dt-git-flow
description: Use when integrating a feature branch into the base branch following the team's git workflow — branch from the latest origin base (/dt-git start), then rebase onto it and integrate with the configured strategy (default main + --no-ff merge commit preserving all commits; or squash, rebase, or a PR), push per policy, and clean up the feature branch (/dt-git finish). Triggers on "메인에 머지해줘", "피처 브랜치 통합", "/dt-git". Stack-agnostic (FE/BE 무관).
---

# dt-git-flow

피처 브랜치 작업을 **팀 절차**로 기준 브랜치에 통합한다. 모든 파괴적 단계(rebase·merge·push·강제 삭제)는
**계획 프리뷰 → 명시 승인** 후 실행한다.

## 설정
절차는 `.dt.json`의 `gitFlow`를 따른다(키의 뜻: `${CLAUDE_PLUGIN_ROOT}/docs/refs/config-schema.md`).
설정이 없으면 기본값 그대로다. 기준 브랜치는 `main`, 머지는 `--no-ff`(모든 커밋 보존 + 머지 지점 표시), 접두어 제안은 `feat/`, 머지 뒤 `main`을 push한다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/gitFlow.mjs" config --project .
```

결과의 `baseBranch`·`baseRef`(예: `origin/develop`)·`mergeStrategy`·`pushPolicy`를 이 문서의 `<base>`·`<baseRef>` 자리에 쓴다. `warnings`가 있으면 먼저 한 줄로 보인다. 원격은 `origin`으로 고정이다.

## 불변 안전장치
1. **파괴적 작업(rebase·merge·push·`branch -D`) 전 항상 프리뷰 → 명시 승인.**
2. **충돌·모호함은 자동 처리 금지** — 멈추고 사용자에게 넘긴다.
3. **기준 브랜치 직접 작업 차단** — finish는 피처 브랜치에서만 실행한다.
4. **stash/커밋 임의 생성 안 함** — 더티 트리는 사용자가 처리한다.
5. **기준 브랜치에는 절대 force push 안 함** — force는 피처 브랜치 + `--force-with-lease`로만.

## 상태 읽기
소비 프로젝트 루트에서 `node "${CLAUDE_PLUGIN_ROOT}/skills/dt-git-flow/scripts/state.mjs"`를 실행해 JSON을 읽는다. 인자가 없으면 `gitFlow.baseBranch`로 기준을 잡는다.
결과는 `{ currentBranch, baseBranch, isBase, detached, dirty, rebaseInProgress, aheadBehind }`다(`isMain`은 옛 이름이라 보지 않는다).

## /dt-git start <이름>
origin 최신 기준 브랜치에서 피처 브랜치를 분기한다.
1. 상태 읽기 → `dirty`면 멈추고 commit/stash 안내(임의 stash 금지) <!-- hard-stop: 커밋 안 된 변경을 대신 처리하면 작업이 사라질 수 있다 -->.
2. `node "${CLAUDE_PLUGIN_ROOT}/scripts/gitFlow.mjs" start --name <이름> --project .`로 순서를 받는다.
   - `suggestion`이 있으면(이름에 슬래시가 없고 접두어 설정이 있음) 그 이름을 한 번 제안만 한다. 강제하지 않는다.
3. `steps`를 차례로 실행한다: `git fetch origin` → `git switch -c <이름> <baseRef>`.
4. 보고: "<이름>를 <baseRef>(<short-sha>) 기준으로 생성".

## /dt-git finish
1. **사전 점검** — 상태 읽기:
   - `isBase`면 멈춘다(피처 브랜치에서만) <!-- hard-stop: 기준 브랜치를 자기 자신에 합칠 수 없다 -->.
   - `dirty`면 멈춘다(커밋 안 된 변경은 사용자가 처리) <!-- hard-stop: 리베이스가 커밋 안 된 변경을 망가뜨릴 수 있다 -->.
   - `rebaseInProgress`면 → "재개" 절로 간다.
   - `aheadBehind`가 `null`이면(`<baseRef>` ref 없음) 중단하고 `git fetch origin` 먼저 안내.
   - `aheadBehind.ahead < 1`이면 멈춘다(합칠 커밋 없음) <!-- hard-stop: 할 일이 없다 -->.
   - (advisory) 프로젝트에 수용 e2e가 있으면(`test:accept` 스크립트 존재) 합치기 전 실행해 그린 확인 권장 — 회귀가 기준 브랜치에 들어가는 것을 막는 마지막 로컬 게이트(차단 아님·권장).
2. **계획 받기** — `node "${CLAUDE_PLUGIN_ROOT}/scripts/gitFlow.mjs" finish --feature <feat> --behind <aheadBehind.behind> --project .`
   - `needsMessage`가 true면(`no-ff`·`squash`) 피처 브랜치 커밋으로 머지 메시지를 만들어 보이고, 승인받은 문장으로 `--message "<문장>"`을 붙여 다시 받는다.
3. **계획 프리뷰 → 승인** — `steps`의 명령을 순서대로 한 줄씩 보이고, `after`를 덧붙인다. 방식별로 달라지는 점:
   - `no-ff`: 리베이스 → 기준 최신화 → `merge --no-ff -m` → push → `branch -d`.
   - `squash`: 리베이스 → 기준 최신화 → `merge --squash` + `commit -m`(커밋 하나) → push → `branch -D`. `-D`는 git이 squash를 머지로 보지 않아 필요하고, 그 단계 직전에 **따로 한 번 더 승인**받는다(`approve: true`).
   - `rebase`: 리베이스 → 기준 최신화 → `merge --ff-only`(일직선) → push → `branch -d`.
   - `pr`: 리베이스 → 피처 브랜치 `push --force-with-lease` → PR 열기. 로컬 머지·기준 push·브랜치 삭제는 하지 않는다(호스트에서 머지한다).
   - `pushPolicy: none`이면 push 단계가 없다. 끝에 "<base>는 push하지 않았다"고 알린다.
4. **실행** — 승인받은 `steps`를 한 단계씩 실행한다. **실패하면 그 자리에서 멈추고 보고**한다(다음 단계로 넘어가지 않는다).
   - `rebase` 충돌: `git status`로 충돌 파일을 보여주고, 사용자가 해결 후 `git rebase --continue` → `/dt-git finish`를 다시 실행하면 이어간다고 안내.
   - `update-base`(`--ff-only`) 실패: 보통 로컬 기준 브랜치가 origin과 갈라진 경우다 — 임의 머지/리셋 말고 상황을 알리고 어떻게 정리할지 확인받는다.
   - 머지·커밋 명령에는 늘 `-m`이 있어 에디터가 열리지 않는다(에이전트 Bash에서 멈춤 방지).
   - `open-pr`의 `cmd`가 있으면(`gh`·`glab`) 실행하고, 없으면 `url`을 보여 사용자가 연다. `url`도 없으면 호스트에서 열라고 안내한다.
5. **원격 피처 브랜치** — `pr`이 아니고 `remoteBranchExists(<feat>)`면 origin 삭제도 할지 **질문**(자동 삭제 X).
6. 결과 보고.

### 재개 (충돌 후 재실행)
`rebaseInProgress`가 false이고 현재 피처 브랜치가 `<baseRef>` 위에 선형으로 얹혀 있으면
(= `aheadBehind.behind === 0`) 계획에 리베이스 단계가 빠진다(`--behind 0`). 그대로 다음 단계부터 이어간다. 여전히 `rebaseInProgress`면
사용자에게 먼저 `git rebase --continue` 또는 `--abort`를 마치라고 안내한다.
> 이 조건(`behind === 0`)은 리베이스가 애초에 불필요했던 **최초 실행**에서도 충족될 수 있다 —
> 그 경우도 똑같이 리베이스 없이 이어가면 된다.

## 수동 옵션 (기본 흐름 아님)
- "피처 브랜치 원격에 올려줘" 요청 시: `git push --force-with-lease origin <feat>`
  (최초면 일반 push). force는 **피처 브랜치에만**, 기준 브랜치엔 절대 사용하지 않는다.
