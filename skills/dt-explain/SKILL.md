---
name: dt-explain
description: Use when the user asks to explain a problem, bug, Jira ticket, or issue — "이게 왜 이런거야", "설명해줘", "어떻게 고쳐?", "원인이 뭐야" — or when answering any newly discovered defect. Produces a structured, plain-language answer (problem → evidence-labeled cause chain → project-grounded example → 2-3 solutions with downsides → one-line summary) instead of an unstructured dump.
---

# dt-explain

발견한 문제(지라 티켓·버그·이슈)를 **구조화된 쉬운 답변**으로 설명한다.
답변 골격은 `references/answer-frame.md`(SOT), 문장 규율은
`${CLAUDE_PLUGIN_ROOT}/docs/refs/readable-writing.md`(쉬운 언어 SOT)를 따른다 — 여기에 중복 정의하지 않는다.
답변 초안이 완성되면 **본문에 내기 전에** `Task`로 `ko-writing-reviewer`에 `{ text: <초안>, docType: 'explain' }`을 넘겨 1회 리뷰받는다. `NEEDS_REPAIR`면 `findings[].after`를 끼운 최종 답을 본문에 낸다(`needsHuman: true` 항목은 `after`가 비어 있으니 끼우지 않는다). 바뀐 문장이 있거나 `needsHuman` 항목이 있으면 답 끝에 접은 블록(`<details>` 또는 "고친 문장 N개" 한 줄)으로 before→after를 짧게 남기고, `needsHuman` 항목은 그 블록에 "확인 요망: <행> <이유>"로 한 줄씩 적는다. 재리뷰 없음. 서브에이전트 미가용 시 lint + 체크리스트를 직접 대조하고 한 줄 고지한다.

명시 호출(`/dt-explain`)이 없어도, 문제 설명 요청이면 이 절차를 따른다.

## 절차

### 0. 입력 파악
- 지라 티켓 키(예: PROJ-99)면 Atlassian MCP로 티켓을 읽는다(제목·설명·코멘트).
- 자유 텍스트·에러 메시지·코드 위치면 그대로 출발점으로 삼는다.
- 모드(풀/퀵) 판정은 조사 후에 한다 — 조사 전 "간단해 보인다"로 퀵을 선점하지 않는다.

### 1. 근거 확보
- 코드베이스 접근이 가능하면 관련 코드를 **반드시 직접 열어** 확인한다 — 🟢 라벨의 조건.
  로그·티켓 코멘트·git 이력도 근거가 된다.
- 조사 범위가 넓으면(어느 파일인지도 모를 때) Explore 에이전트 1회 dispatch 허용.
  상시화 금지 — 파일을 아는데도 위임하지 않는다(토큰 가드).
- 코드 접근 불가(기획 단계·외부 시스템)면 전 항목 🟡로 쓰고, 답변 끝에
  **"확인하면 확정할 수 있는 것"** 목록(무엇을 보면 어느 🟡가 🟢로 바뀌는지)을 붙인다.

### 2. 모드 판정 + 작성
- `references/answer-frame.md`의 조건으로 풀/퀵을 판정하고, 해당 템플릿으로 작성한다.
- `--quick` 인자가 오면 퀵 모드 강제(단 원인이 자명하지 않으면 풀로 승격하고 사유를 말한다).

### 3. 출력 전 게이트
출력 전 answer-frame.md의 출력 전 게이트 체크리스트로 점검한다. 어기면 고친 뒤 출력한다.

### 4. 후속 (선택)
답변 후 필요해 보이면 "비개발자용으로 다시 설명해드릴까요?" 정도만 제안한다.

## 비범위 (v1)
- **외부 쓰기 전부** — 지라 코멘트·Confluence 등에 쓰지 않는다(채팅 답변 전용).
  기록이 필요하면 dt-worklog-sync 등 기존 흐름으로 별도 진행.
- 실제 코드 수정 실행 — 설명·제안까지. 수정은 사용자가 요청하면 별도 흐름으로.
