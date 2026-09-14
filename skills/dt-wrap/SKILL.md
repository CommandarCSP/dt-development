---
name: dt-wrap
description: Use when wrapping up a chunk of work — chains commit (feature branch) → Confluence doc decision → Jira sync into one routine. Triggered by the Stop hook reminder ("정리 안 된 작업 N커밋") or manually via /dt-wrap. Stops are nudged, never auto-run; each step keeps its own dry-run→approval. Triggers on "마무리 루틴", "작업 정리해줘", "/dt-wrap".
---

# dt-wrap

작업이 어느 정도 끝났을 때 **커밋 → Confluence 판단 → Jira 동기화**를 순서대로 진행하는
마무리 루틴이다. Stop hook이 "정리 안 된 작업 N커밋"을 감지해 이 루틴을 권유하지만,
실행은 항상 사용자 확인 하에 이뤄진다.

## 활성화 (opt-in)
`.dt-pipeline.json`이 프로젝트 루트에 있어야 hook이 작동한다. 없으면 `/dt-wrap --init`으로
`references/dt-pipeline.example.json`을 복사해 생성한다(`enabled`/`commitThreshold`/`startReminder`).

## 흐름

각 단계는 **"의견 제시 → 사용자 확인"** 게이트를 거친다. 모델이 먼저 이 작업에 그 단계가
필요한지 **권장/비권장 + 한 줄 근거**를 제시하고, 사용자가 **할지/건너뛸지** 확정한 뒤에만 실행한다.

1. **커밋 정리** — `git status`의 더티 변경을 의미 단위로 커밋(사용자 확인). 메시지는 작업 요약.
   - 현재 main이면 작업을 피처 브랜치로 옮기도록 `/dt-git start <이름>` 먼저 권유한다.
2. **Confluence 작성 — 제안 → 확인** — 먼저 이 작업이 문서화할 가치가 있는지 **내 의견**을 낸다.
   예: "기능 추가·설계 결정이 있어 techdoc 권장" / "단순 버그 수정이라 문서화 불필요(비권장)".
   그다음 사용자에게 **작성할지 / 건너뛸지** 확인받는다.
   - 작성 동의 시에만 `dt-confluence-doc`을 호출한다(타입·스페이스는 그 스킬이 확인).
   - 건너뛰기면 아무 것도 만들지 않고 3단계로 넘어간다. **자동 작성 금지.**
3. **Jira 동기화 — 제안 → 확인** — 먼저 이 작업을 Jira에 기록할지 **내 의견**을 낸다(권장/비권장 +
   근거: 어떤 부모 이슈 아래 어떤 Sub-task로). 그다음 사용자에게 **동기화할지 / 건너뛸지** 확인받는다.
   - 동의 시에만 `dt-worklog-sync`를 호출한다. Sub-task 생성/상태전이 + 산출물 링크 + **DoD 체크박스 갱신**(상태만 바꾸지 말고 충족된 `- [ ]`를 `- [x]`로),
     완료 시 `lastSyncSha=HEAD` 갱신 → Stop 넛지가 자동으로 조용해진다.
   - 건너뛰기면 동기화하지 않는다(이 경우 `lastSyncSha`는 갱신되지 않아 다음 Stop 넛지가 다시 뜰 수 있음). **자동 동기화 금지.**

## 안전장치
1. **단계마다 의견 → 확인** — Confluence 작성·Jira 동기화는 모델이 필요성 의견을 제시한 뒤
   사용자가 할지/말지 확정해야 실행한다. 확인 없이 자동 작성·동기화하지 않는다.
2. **자동 실행 없음** — 실행에 동의한 단계도 해당 스킬의 dry-run→승인을 그대로 따른다.
3. **main 통합은 범위 밖** — `/dt-git finish`(리베이스→머지→push)는 사용자가 별도로 판단한다.
4. **건너뛰기 허용** — 사용자가 특정 단계를 건너뛰면 다음 단계로 진행하거나 종료한다.

## 관련 스킬
- `dt-git-flow` — 피처 브랜치 분기/통합 (start는 1단계에서 권유, finish는 별도)
- `dt-confluence-doc` — 2단계 문서 작성
- `dt-worklog-sync` — 3단계 Jira 동기화 (lastSyncSha 갱신 주체)
