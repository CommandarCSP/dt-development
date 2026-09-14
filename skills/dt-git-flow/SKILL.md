---
name: dt-git-flow
description: Use when integrating a feature branch into main following the team's git workflow — branch from latest origin/main (/dt-git start), then rebase onto latest origin/main, merge with a --no-ff merge commit preserving all commits, push main, and clean up the feature branch (/dt-git finish). Triggers on "메인에 머지해줘", "피처 브랜치 통합", "/dt-git". Stack-agnostic (FE/BE 무관).
---

# dt-git-flow

피처 브랜치 작업을 **표준 절차**로 main에 통합한다. 모든 파괴적 단계(rebase·merge·main push)는
**계획 프리뷰 → 명시 승인** 후 실행한다. 상태 판단은 `scripts/state.mjs`로 한다.

> 베이스 브랜치는 `main`(origin/main 기준). 머지는 항상 `--no-ff`(모든 커밋 보존 + 머지 지점 표시).

## 불변 안전장치
1. **파괴적 작업(rebase·merge·main push) 전 항상 프리뷰 → 명시 승인.**
2. **충돌·모호함은 자동 처리 금지** — 멈추고 사용자에게 넘긴다.
3. **로컬 main 직접 작업 차단** — finish는 피처 브랜치에서만 실행한다.
4. **stash/커밋 임의 생성 안 함** — 더티 트리는 사용자가 처리한다.
5. **main에는 절대 force push 안 함** — force는 피처 브랜치 + `--force-with-lease`로만.

## 상태 읽기
`node scripts/state.mjs origin/main` 를 소비 프로젝트 루트에서 실행해 JSON을 읽는다:
`{ currentBranch, isMain, detached, dirty, rebaseInProgress, aheadBehind }`.

## /dt-git start <이름>
origin 최신 main에서 피처 브랜치를 분기한다.
1. 상태 읽기 → `dirty`면 중단하고 commit/stash 안내(임의 stash 금지).
2. `git fetch origin`
3. `git switch -c <이름> origin/main`
4. 보고: "<이름>를 origin/main(<short-sha>) 기준으로 생성".
- 이름은 사용자가 준 값 그대로. 슬래시가 없으면 `feat/` prefix를 한 번 제안만 한다(강제 X).

## /dt-git finish
1. **사전 점검** — 상태 읽기:
   - `isMain`이면 중단(피처 브랜치에서만).
   - `dirty`면 중단(커밋 안 된 변경은 사용자가 처리).
   - `rebaseInProgress`면 → "재개" 절로 간다.
   - `aheadBehind`가 `null`이면(origin/main ref 없음) 중단하고 `git fetch origin` 먼저 안내.
   - `aheadBehind.ahead < 1`이면 중단(머지할 커밋 없음).
   - (advisory) 프로젝트에 수용 e2e가 있으면(`test:accept` 스크립트 존재) 머지 전 실행해 그린 확인 권장 — 회귀가 main에 들어가는 것을 막는 마지막 로컬 게이트(차단 아님·권장).
2. `git fetch origin`
3. **계획 프리뷰 → 승인**:
   - 리베이스: <feat>의 N개 커밋 → origin/main(<sha>) 위로
   - 머지: --no-ff
   - push: main만 (일반 push)
   - 완료 후: 로컬 <feat> 브랜치 삭제
4. `git rebase origin/main`
   - 충돌 시: **멈춤**. `git status`로 충돌 파일을 보여주고, 사용자가 해결 후
     `git rebase --continue` → `/dt-git finish` 재실행 시 5번부터 이어가라고 안내.
5. `git switch main && git merge --ff-only origin/main`  (로컬 main 최신화)
   - 둘 중 하나라도 실패하면 **중단하고 보고**(다음 단계로 진행 금지).
   - `--ff-only` 실패는 보통 로컬 main이 origin과 갈라진 경우다 — 임의 머지/리셋 말고
     사용자에게 상황을 알리고 어떻게 정리할지 확인받는다.
6. 머지 커밋 메시지를 만들어 **프리뷰 → 승인** 후 `git merge --no-ff -m "<승인된 메시지>" <feat>`
   실행. `-m`을 반드시 줘서 에디터가 열리지 않게 한다(에이전트 Bash에서 멈춤 방지).
7. `git push origin main`  (fast-forward)
8. `git branch -d <feat>`  (머지 완료 → 안전 삭제)
   - `remoteBranchExists(<feat>)`면 origin 삭제도 할지 **질문**(자동 삭제 X).
9. 결과 보고.

### 재개 (충돌 후 재실행)
`rebaseInProgress`가 false이고 현재 피처 브랜치가 origin/main 위에 선형으로 얹혀 있으면
(= `aheadBehind.behind === 0`) 4번을 건너뛰고 5번부터 이어간다. 여전히 `rebaseInProgress`면
사용자에게 먼저 `git rebase --continue` 또는 `--abort`를 마치라고 안내한다.
> 이 조건(`behind === 0`)은 리베이스가 애초에 불필요했던 **최초 실행**에서도 충족될 수 있다 —
> 그 경우도 동일하게 5번부터 진행하면 된다(불필요한 rebase no-op 생략).

## 수동 옵션 (기본 흐름 아님)
- "피처 브랜치 원격에 올려줘" 요청 시: `git push --force-with-lease origin <feat>`
  (최초면 일반 push). force는 **피처 브랜치에만**, main엔 절대 사용하지 않는다.
