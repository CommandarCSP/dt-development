# 참조: 상향 정합 (deep-read ↔ 정의서 IF diff) — 게이트 + 쓰기 (T2~T8)

> 종류: **참조 문서(지식)** · 소비처: `dt-spec-generate-spec`(FE)·`dt-bespec-generate-spec`(BE)·`spec-author`·`bespec-author`.
> SOT: 본 문서. (이전엔 두 스킬에 거의 동일 블록이 중복돼 있었음 — 공유 ref로 일원화.)
>
> **스택 파라미터** (Read하는 쪽이 자기 값으로 적용):
> - `deepRead` = 실제 요청/응답 계약의 출처. **FE**: Figma deep-read. **BE**: OpenAPI/데이터모델에서 추출한 실제 계약.
> - `unitRef` = provenance 마커 브랜드. **FE**: `dt-spec/<page>`. **BE**: `dt-bespec/<resource>`.

산출 직전, `deepRead`로 얻은 실제 요청/응답 계약을 정의서 IF와 diff하고(아래→위), 잠정 IF는 직접 갱신·승격한다. **모든 정의서 쓰기는 diff-then-confirm(무확인 덮어쓰기 금지, 불변원칙 3).** §0이 `consume`(generated)일 때만 적용 — standalone/migrate/hand-authored는 쓰기 금지(읽기/시드만).

1. 정의서 IF 행과 `deepRead` 계약을 각각 `{ method, requestParams, statusCodes, responseFields }`로 정리(요청 파라미터 키·메서드·상태코드 + 응답 shape 필드).
2. `definitionPropagation.detectDrift(definitionIF, deepReadContract)` → `{ missing, conflicting }`(`conflicting`엔 메서드/상태코드 + `shape:` 응답필드 누락). **구조 비교만** 담당 → 필터/정렬 규칙 등 의미 차이는 `deepRead` 텍스트 근거로 직접 판단해 함께 보고.
3. 드리프트 있으면 **반드시 "정의서 드리프트 리포트" 산출**(게이트=필수, 침묵 금지): 어느 IF가 무엇을 누락/모순하는지 + 근거.
4. **상태 전이로 정의서 갱신(diff-then-confirm):**
   - **잠정(`컨벤션`/`협의중`) IF** — deep-read 보강이 이긴다(D8): 값 일치면 **T2**(그대로 `확정` 승격), 다르면 **T3**(실제값으로 교정 + `## 변경 추적` 로그하며 `확정` 승격). `미해소(질문완료)`는 **T5**(공급원 따라 승격).
   - **`확정` IF 개정(T6)** — **무확인 적용 금지(lock).** 재확인 후에만: 세션 내 diff-then-confirm → 직접 갱신 + 변경추적 + `definitionVersion`+1; 즉시 못 쓰면 `<!-- conflict: IF-n -->` 마커 후 dt-devspec 재실행 §3 큐. 승인 전 기존 `확정` 유지.
   - **`확정`인데 원본이 바뀜(T7)** — 조용히 무시 금지: §3 재확인 큐로 surface → 승인 시 갱신 + 버전 +1. **단 BE(dt-bespec)엔 Figma 어댑터가 없어 Figma 출처 IF의 원본 재추론은 비적용**(G1 한계) — 문서 출처 IF만 재파싱 가능, Figma 출처 T7은 dt-devspec/dt-spec 소관. (FE는 Figma 재추론 가능.)
   - **폐기(T8)** — `<!-- deprecate: IF-n -->` 후 dt-devspec §3 큐 → `deprecated` 표기(묘비, 삭제 아님) + 버전 +1.
   - **충돌 권위(D8):** `확정` > 잠정 > 원본. FE 보강이 정의서 `확정`과 모순이면 정의서가 이긴다(충돌 표시만). FE↔BE 충돌은 **BE 계약면 권위**(엔드포인트·응답 형태는 BE 소유) → 어긋난 FE 보강은 §3 협의 큐.
5. **쓰기 절차(필수 순서):**
   - **compare-and-swap(H3):** 쓰기 직전 `docs/specs/definition.md` 재파싱 → 헤더 `definitionVersion`이 1번에서 읽은 값과 **다르면 abort**(다른 세션이 먼저 갱신) → 현재 값 위에서 재diff 후 다시 confirm.
   - 갱신 시 `definitionVersion`+1 + **provenance 마커** `<!-- updatedBy: <unitRef>@vN -->`(`from:` 파서가 소비 안 함).
   - **self-stale 회피:** 정의서를 v→v+1 올리는 **같은 작업에서** 자기 스펙 헤더의 `basedOnDefinition`도 v+1로 갱신(자기 변경에 자기가 stale로 안 잡힘).
   - 쓰기는 temp→원자적 rename(부분쓰기 소실 방지), 실패 시 원본 유지.

※ `detectDrift`/`isStale`/`computeImpacted`/`extractBasedOnDefinition`는 `scripts/definitionPropagation.mjs`에서 import. **`확정` lock·diff-then-confirm은 절대 우회 금지.**

## 최종 정합 게이트 (산출 **후** — SOT 반영 강제)

> 위 1~5는 산출 **직전** `deepRead↔SOT` diff다. 하지만 산출 과정(ask-missing 값 채움·소스 우선순위 해소·api-contract 3-way·EARS 변환)에서 **최종 산출물이 SOT와 또 달라질 수 있다.** 그래서 **최종 스펙 작성 후** 한 번 더, 이번엔 `deepRead`가 아니라 **최종 산출물 계약 자체**를 SOT와 대조해 **강제 정합**한다. consume(generated)일 때만 적용.

**대상 계약면:** **BE** `api-contract.md`의 엔드포인트/스키마(`method·path·request·response shape·status`) ↔ 정의서 IF. (**FE**도 대칭: `design.md`의 API 계약/`layout-skeleton`이 참조하는 IF ↔ 정의서 IF.)

**절차:**
1. `detectDrift(정의서 IF, 최종 산출물 계약)`을 **다시** 실행(입력이 deepRead가 아니라 방금 쓴 산출물).
2. 드리프트가 있으면 — **조용히 넘길 수 없다(강제):**
   - **잠정 IF와 다름** → **반드시** T2/T3로 정의서 갱신(diff-then-confirm 승격). 스킵 불가.
   - **`확정` IF와 모순(T6)/원본 변경(T7)** → 무확인 덮어쓰기는 여전히 금지(lock)지만 **반드시 surface**: 세션 내 재확인으로 갱신하거나 `<!-- conflict: IF-n -->` + dt-devspec §3 큐. 이 경우 스펙은 아래 3의 강제로 `draft`.
   - **SOT에 없는 새 엔드포인트/스키마를 최종 스펙이 도입** → T2 신규 IF로 정의서에 **추가**(confirm) 또는 §3 큐.
3. **finalize 조건(강제, 핵심):** **최종 산출물 계약과 SOT IF 사이 미반영 드리프트 = 0** 이어야 `status: finalized`. 반영(정의서 갱신)도 큐잉(§3)도 안 된 드리프트가 하나라도 남으면 **`status: draft` 강등**. → "SOT를 조용히 벗어난 채 완료"되는 경로를 제거 — **반영하거나 명시적으로 큐잉하거나** 둘 중 하나만 허용.
4. 정의서 쓰기는 위 5의 compare-and-swap(H3)·provenance·self-stale 회피·원자적 rename을 그대로 따른다. 변경 전파와 마찬가지로 **한 실행에서 버전 이중 bump 금지**(산출 직전 정합에서 이미 bump했으면 그 위에서 재diff).

## 대조 차원 (diff에 반드시 포함할 계약 요소)

IF 행 수준(method·path·존재 여부)만 diff하면 내용 드리프트가 샌다 — 실측 프로젝트 사례:
정의서 IF-1은 DM-1 전체 필드인데 auth api-contract는 축소 shape(4필드)로 작성돼 통과,
IF-17 "최신순"은 comments api-contract에 정렬 자체가 누락된 채 통과. 그래서 diff는 최소
다음 차원을 포함한다:

1. **응답 shape 필드 목록** — 정의서 DM-n(계약면 공유 shape) ↔ leaf 계약의 필드·타입 대조
2. **정렬·페이지네이션·필터 규약** — 정의서 IF 행에 있으면 leaf에 옮겨졌는지(누락 = 드리프트)
3. **상태코드 집합** — IF 행 ↔ api-contract 행
4. 그 외 요소는 `${CLAUDE_PLUGIN_ROOT}/skills/dt-audit/references/contract-elements.md`
   체크리스트를 대조 차원으로 준용한다 — 정의서가 침묵하는 요소는 드리프트가 아니라
   leaf의 자체 결정 영역이니 leaf에 **명시**돼 있는지만 본다(명시 없으면 산출 전에 채우도록
   ask-missing으로 라우팅).
