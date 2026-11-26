---
name: dt-wrap
description: Use when wrapping up a chunk of work — runs the configured wrap steps in order (default commit → wiki doc decision → tracker sync; steps whose adapter is off are skipped). Triggered by the Stop hook reminder ("정리 안 된 작업 N커밋") or manually via /dt-wrap. Stops are nudged, never auto-run; each step keeps its own dry-run→approval. Triggers on "마무리 루틴", "작업 정리해줘", "/dt-wrap".
user-invocable: false
---

# dt-wrap

작업이 어느 정도 끝났을 때 마무리 단계를 순서대로 밟는 루틴이다. 기본 순서는
**커밋 정리 → 위키 문서 판단 → 작업 기록 동기화**이고, 팀이 `.dt.json`의 `wrap.steps`로 바꿀 수 있다.
Stop hook이 "정리 안 된 작업 N커밋"을 감지해 이 루틴을 권하지만, 실행은 항상 사용자 확인을 거친다.

## 활성화 (opt-in)
공통 설정 `.dt.json`에 `hooks` 섹션이 있어야 hook이 작동한다(옛 `.dt-pipeline.json`도 계속 읽는다).
키의 뜻은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/config-schema.md`가 정한다.

`/dt-wrap --init`은 다음을 한다. 파일을 쓰기 전에 무엇을 만들지 보이고 확인받는다.
1. `.dt.json`이 없으면 `${CLAUDE_PLUGIN_ROOT}/skills/dt-wrap/references/dt.example.json`으로 만든다. 있으면 `hooks` 섹션만 없을 때 더한다(다른 키는 건드리지 않는다).
   - 이때 이 팀이 트래커·위키를 쓰는지 묻고 `tracker`·`wiki`를 채운다. 기본은 `jira`·`confluence`이고, 안 쓰면 `none`이다.
2. 옛 `.dt-pipeline.json`이 있으면 그 값을 `hooks`로 옮기고, 옛 파일을 지울지 묻는다.
3. `.gitignore`에 개인 파일 `.dt.local.json`(개인 덮어쓰기)과 `.dt-pipeline.local.json`(마무리 기준점)이 없으면 더한다.
4. 스택 설정(`.dt-frontend.json`·`.dt-backend.json`)이 없으면 `${CLAUDE_PLUGIN_ROOT}/docs/refs/stack-config-bootstrap.md` 절차로 감지한 스택의 설정도 만든다.
5. `node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/config.mjs" .`로 읽어 `warnings`가 없는지 확인하고, 만든 파일과 값을 한 줄씩 보고한다.

## 단계 정하기

시작할 때 실제로 돌 단계를 계산한다. 훅의 알림 문구도 같은 계산을 쓴다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/wrapState.mjs" steps --project .
```

- 결과의 `steps`를 그 순서대로 밟는다. 단계 이름은 `commit`·`wiki`·`tracker` 세 가지다.
- `skipped`에 있는 단계는 어댑터가 꺼진 것이다. 시작할 때 "건너뜀: 위키(wiki: none)"처럼 한 줄로 알리고 넘어간다.
  - 위키 단계는 `wiki`가 `confluence`·`markdown`일 때만 돈다(`notion`은 아직 연동하지 않아 뺀다).
  - 트래커 단계는 `tracker`가 `jira`일 때만 돈다(`github`·`linear`는 아직 연동하지 않아 뺀다).
- `warnings`가 있으면(모르는 단계 이름, 중복) 먼저 한 줄로 보이고, 계산된 단계를 밟는다.

## 단계

각 단계는 **"의견 제시 → 사용자 확인"** 게이트를 거친다. 모델이 먼저 이 작업에 그 단계가
필요한지 **권장/비권장 + 한 줄 근거**를 제시하고, 사용자가 **할지/건너뛸지** 확정한 뒤에만 실행한다.

### `commit` — 커밋 정리
- `git status`의 바뀐 파일을 의미 단위로 커밋한다(사용자 확인). 메시지는 작업 요약이다.
- 현재 main이면 작업을 피처 브랜치로 옮기도록 `/dt-git start <이름>`을 먼저 권한다.

### `wiki` — 위키 문서 판단
- 먼저 이 작업을 문서로 남길 가치가 있는지 **내 의견**을 낸다. 문서 종류는 TP-003의 7종 중에서 고른다.
  - 예: "설계 결정이 있어 설계 문서(`design`) 권장", "배포 절차가 바뀌어 운영 가이드(`guide`) 갱신 권장", "단순 버그 수정이라 문서 불필요(비권장)".
- 그다음 사용자에게 **작성할지 / 건너뛸지** 확인받는다.
  - 작성에 동의하면 `dt-confluence-doc`을 호출한다. 종류·구역·위치는 그 스킬이 확인하고, `wiki: markdown`이면 저장소 `docs/wiki/`에 쓴다.
  - 건너뛰면 아무것도 만들지 않고 다음 단계로 넘어간다. **자동 작성 금지.**

### `tracker` — 작업 기록 동기화
- 먼저 이 작업을 트래커에 기록할지 **내 의견**을 낸다. 근거로 어느 이슈에 남길지 적는다. 기본 단위는 TP-002의 Story·Task·Bug이고, Sub-task는 나눌 때만 쓴다.
- 그다음 사용자에게 **동기화할지 / 건너뛸지** 확인받는다.
  - 동의하면 `dt-worklog-sync`를 호출한다. 그 스킬이 진행 댓글, 완료 조건 체크박스(HTML task list), 상태 전이를 맡는다. 완료로 옮길 때는 산출물이나 결정 사항이 있는 마무리 댓글이 필요하다.
  - 건너뛰면 기록하지 않는다. **자동 동기화 금지.**

## 마치기

마지막 단계가 끝나면, 건너뛴 단계가 있어도 기준점을 남긴다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/wrapState.mjs" mark --project .
```

- `.dt-pipeline.local.json`의 `lastWrapSha`에 HEAD가 들어간다. Stop 훅은 이 값부터 커밋을 세므로, 새 커밋이 생길 때까지 알림이 조용하다.
- 훅은 `dt-worklog-sync`가 남기는 `lastSyncSha`도 함께 보고, 둘 중 더 최근 것부터 센다. 그래서 `/dt-worklog`만 따로 돌려도 알림이 조용해진다.
- 루틴을 중간에 그만두면(사용자가 "그만") 기준점을 남기지 않는다. 다음 Stop에서 다시 권한다.
- 끝나면 한 줄로 보고한다. 예: "마무리: 커밋 2개 · 문서 건너뜀 · DEV-16 완료 · 건너뜀: 없음".

## 안전장치
1. **단계마다 의견 → 확인** — 문서 작성·작업 기록은 모델이 필요성 의견을 제시한 뒤
   사용자가 할지/말지 확정해야 실행한다. 확인 없이 자동 작성·동기화하지 않는다.
2. **자동 실행 없음** — 실행에 동의한 단계도 그 스킬의 dry-run→승인을 그대로 따른다.
3. **main 통합은 범위 밖** — `/dt-git finish`(리베이스→머지→push)는 사용자가 별도로 판단한다.
4. **건너뛰기 허용** — 사용자가 특정 단계를 건너뛰면 다음 단계로 넘어가거나 마친다.

## 관련 스킬
- `dt-git-flow` — 피처 브랜치 분기/통합 (start는 `commit` 단계에서 권함, finish는 별도)
- `dt-confluence-doc` — `wiki` 단계 문서 작성 (`docs/refs/wiki-adapter.md`)
- `dt-worklog-sync` — `tracker` 단계 작업 기록 (`docs/refs/tracker-adapter.md`, `lastSyncSha`를 남긴다)
