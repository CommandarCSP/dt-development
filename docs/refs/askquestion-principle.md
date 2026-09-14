# 참조: askQuestion 작성 원칙 (모든 AskUserQuestion 공통)

> 종류: **참조 문서(지식)** · 소비처: `dt-spec-generate-spec`, `dt-spec-ask-missing`, `dt-spec-collect-project-context`, 향후 `spec-author`/`bespec-author` 에이전트.
> SOT: 본 문서. (이전엔 `dt-spec-ask-missing` SKILL.md가 원본이었고 다른 스킬이 그걸 가리켰음 — ask-missing 해체에 대비해 ref로 승격.)

AskUserQuestion 호출 시 사용자가 "무엇을, 왜 설정하는지" 즉시 이해하도록 맥락을 충분히 담는다. **질문 한 줄 + 라벨만 있는 옵션은 금지** (사용자가 의도를 파악 못 함).

각 질문은 3요소를 포함한다:
1. **배경(Why)** — 왜 묻는지 + 현재 페이지/기능 맥락. `question` 첫 문장에 실제 페이지명·추출된 요소명을 넣어 구체화 (예: "이 페이지(SCR_FLE_01 파일관리)의 **login_button**에서 ...").
2. **영향(Impact)** — 이 답이 어느 산출물(requirements.md FR / design.md / tasks.md)에 어떻게 반영되는지 `question`에 명시 (예: "선택한 항목은 requirements.md에 Event-driven FR로 추가됩니다").
3. **옵션 설명(Options)** — 각 `option`의 `description`에 구체적 의미 + 선택 시 결과 + 예시. label만 두지 말 것.

도구 사용 팁:
- `header`: 짧은 주제 태그 (예: "API 후보", "접근 권한", "비기능 요구").
- 항목이 4개를 초과하면 여러 질문으로 분할하거나 `multiSelect: true` 사용 (AskUserQuestion 옵션 최대 4개).
- method/endpoint/schema 같은 **자유 값 입력**은 옵션으로 강제하지 말고, `question`에 입력 형식과 예시를 충분히 제시한 뒤 사용자의 텍스트 답변("Other")을 받는다.

## 무엇을 "애매함"으로 보고 물을 것인가 (판단 예시)

위가 "어떻게 잘 묻나"라면, 아래는 **언제 물어야 하나** — 조용히 넘기거나 임의로 지어내지 말고 `needsDecision`(워커) 또는 AskUserQuestion(조율자)으로 올려야 하는 대표 애매함. **판단 기준: "스펙만으로 한 가지로 확정되지 않고, 추측하면 사용자 의도와 어긋날 수 있다"면 묻는다.**

### 예시 A — 짝 없는 능력 (orphaned capability, 필수 감지)
**한쪽에 능력/계약이 있는데 그것을 소비·노출하는 짝이 스펙에 없을 때.**
- 전형: **BE에 인증 기반(로그인/토큰 발급 API, JWT 처리, 세션)은 있는데 이를 다루는 FE 화면 스펙(로그인/로그아웃/토큰 만료 처리 UI)이 없음.** (역방향도 동일 — UI가 인증 상태를 전제하는데 인증 API가 없음.)
- **하면 안 되는 것:** 로그인 화면을 임의로 만들어 넣기(과생성) / 인증을 조용히 무시하고 나머지만 구현(침묵 누락). 둘 다 사용자 의도와 어긋날 수 있다.
- **물어야 함(needsDecision):**
  - `topic`: "인증 기반(API/JWT)은 있으나 이를 다루는 화면 스펙이 없습니다. 어떻게 처리할까요?"
  - `options` 예: `"로그인/로그아웃 화면 스펙을 추가한다"`(→ 페이지 스펙 신설) / `"인증은 기존/외부 흐름이 처리한다고 가정"`(→ 화면 미생성, 토큰 주입만 전제) / `"이번 범위에서 제외"`(→ 해당 API는 stub·미노출로 표기) / `"별도 협의 필요"`.
  - `evidence`: 어느 계약(예: `POST /auth/login`, `Authorization: Bearer`)이 소비처 없이 떠 있는지.
  - `reflectsTo`: 정의서 IF / 해당 페이지·리소스 스펙.
- 일반화: 능력↔소비처가 1:0으로 뜨면(엔드포인트에 대응 화면 없음, 화면이 없는 상태 전제) 그 갭을 **명시적으로 surface**한다.
