---
name: dt-decision
description: Record, list, and supersede long-lived decisions — project decisions (PD, docs/decisions/) and team policies (TP, plugin docs/policies/). Use when a human decision should hold beyond one page or resource (a convention, a tech choice, a rule override), when a skill proposes a PD draft after a needsDecision answer, or via /dt-decision. Drafts are shown and written only on approval.
---

# dt-decision — 결정 기록(TP · PD)

한 화면·한 리소스를 넘어 **계속 걸리는 사람 결정**을 문서 한 건으로 남기고 찾는다. 정책은 `${CLAUDE_PLUGIN_ROOT}/docs/policies/TP-001-decision-records.md`, 언제 남기는지는 `${CLAUDE_PLUGIN_ROOT}/docs/orchestration-policy.md` 원칙 9.

- **프로젝트 결정 PD** — `<projectRoot>/docs/decisions/PD-NNN-<슬러그>.md`
- **팀 정책 TP** — 플러그인 저장소 `docs/policies/TP-NNN-<슬러그>.md`(플러그인을 고치는 작업이다 — 사용자가 플러그인 저장소에서 돌릴 때만)
- 양식: `${CLAUDE_PLUGIN_ROOT}/templates/decision.md.tmpl` · 도구: `node "${CLAUDE_PLUGIN_ROOT}/scripts/decisions.mjs" list|next|check|show`

## 동작

### new — 새 결정 (기본)
1. **무엇을 정했는지 모은다.** 대화·스킬이 넘긴 needsDecision 답(`id`·고른 선택지·버린 선택지·근거)에서 맥락·결정·이유·버린 대안·출처를 채운다. 비는 칸이 있으면 지어내지 말고 묻는다(`${CLAUDE_PLUGIN_ROOT}/docs/refs/askquestion-principle.md`).
2. **PD로 남길 만한지 확인한다.** 한 단위에만 걸리면 PD를 만들지 않고 "그 산출물에 남기면 충분하다"고 알린다. 기준은 원칙 9.
3. **이미 있는 결정과 겹치는지 본다.** `decisions.mjs list <projectRoot> --all`로 같은 범위의 결정을 찾는다. 있으면 "그 결정을 대체할지(supersede)" 묻는다.
   - 스택 사전 점검(`docs/refs/stack-precheck.md`)에서 온 결정이면 머리말 `topic`에 영역 key(예: `stack.fe.serverState`)를 적는다. 다음 점검이 이 결정을 찾아 다시 묻지 않는다.
4. **초안을 보인다.** `decisions.mjs next <projectRoot>`로 번호를 받아 템플릿을 채운 전문을 보이고 확인받는다.
   - 승인 → `status: accepted`로 쓴다. 보류 → `status: proposed`로 쓰고, 채택 전까지 다른 스킬은 고정 입력으로 쓰지 않는다고 알린다.
5. `decisions.mjs check <projectRoot>/docs/decisions`로 양식을 확인하고 경로를 보고한다.

### list — 목록
`decisions.mjs list <projectRoot>`(채택된 것) 또는 `--all`. 만료된 결정은 "(만료)"로 보이고 다시 검토할지 묻는다.

### supersede — 대체
새 결정을 new 절차로 만들되 머리말에 `supersedes: <옛 id>`를 적는다. 옛 문서는 `status: superseded`, `supersededBy: <새 id>`로 바꾼다. 두 파일을 함께 보이고 승인받는다. 옛 결정을 가리키던 `overrides.<키>.decisionRef`가 있으면 새 id로 바꿀지 함께 묻는다.

### override — 규칙 끄기에 근거 달기
풀 리뷰가 `override-decision-ref`(근거 없는 규칙 끄기)를 냈을 때. 그 규칙을 끈 이유를 묻고 PD를 new로 만든 뒤, 스택 설정의 값을 `{ "value": <원래 값>, "decisionRef": "PD-NNN" }`으로 바꾼다. 끌 이유가 없으면 override를 지우자고 권한다.

## 안 하는 것
- 승인 없이 파일 쓰기 · 한 단위에만 걸리는 답을 PD로 만들기 · 코드 결정 로그 주석(비즈니스 규칙 옆 주석 — `docs/refs/decision-log-comments.md`)이나 정의서 IF 상태를 PD로 옮기기. 둘은 각자 자리가 맞다.
