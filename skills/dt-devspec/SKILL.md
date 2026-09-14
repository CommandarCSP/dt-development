---
name: dt-devspec
description: Use when starting a new project/feature and the team needs a project-level Source of Truth before FE/BE specs — analyzes multi-source UX(Figma pages/PDF/links) — lightweight structure discovery (get_metadata) + a targeted per-screen deep-read (get_design_context, once per data-bearing screen) for IF contract rules — and produces docs/specs/definition.md (FE/BE scope split + interface contract + change traceability). Triggers on "개발 정의서", "FE/BE 범위 정의", "/dt-devspec". Pairs with dt-spec(FE 페이지 스펙)·dt-bespec(BE 리소스 스펙) which reference it.
---

# dt-devspec — 개발 정의서(프로젝트 SOT) 생성

> 산출물: `docs/specs/definition.md` (프로젝트당 1개). dt-spec·dt-bespec이 이 정의서가 있으면 게이트(§0)에서 소비한다(없거나 엉성해도 소프트 게이트로 분기).
> 설계: `docs/superpowers/specs/2026-06-09-dev-definition-sot-design.md` + 후속 `docs/superpowers/specs/2026-06-10-devspec-bidirectional-reconcile-design.md`

## 불변 원칙
1. **발견은 경량, 계약은 우측 주석만 타깃.** 페이지 구조 발견은 `get_metadata`(프레임 전체 순회 + 텍스트)로 한다. IF 계약(쿼리/필터/정렬)은 화면 주석 패널에 있고 `get_metadata`로는 `Description` placeholder만 나오므로 본문이 필요한데, 이 팀 Figma는 화면이 [좌측 UI] + [우측 주석/규칙 글] 레이아웃이다. 그래서 **데이터 흐름·IF 후보가 있는 대상 스크린의 *우측 주석 영역*(x-range로 식별)만 `get_design_context`로 deep-read**해 규칙 전문을 확보한다(우측 글에 IF 규칙이 있고 좌측 UI는 불필요 → 토큰 절감). 우측 영역 식별이 **불확실하면 스크린 통째로 폴백**. 토큰 가드는 **대상 스크린당 1라운드**(우측 주석 묶음 또는 통째 1회분)로 유지하고, 순수 정적·비데이터 스크린은 스킵. deep-read는 IF 계약 추출 용도로만 쓰고 페이지 내부 요소·스타일은 담지 않는다(불변원칙 2). 토큰 폭발 방지.
2. **슬림.** 정의서는 ① FE/BE 범위 분담 ② 인터페이스 합의(전역 규약+IF) ③ 변경 추적 메타만 담는다. NFR·권한·페이지 내부 요소·**풀 엔티티 모델(저장 구조: 인덱스·FK·관계)**·공통 컴포넌트는 담지 않는다(각각 dt-spec/BE스펙/페이지 소유). **단 IF 요청/응답의 *계약면 공유 shape*(필드·타입)는 `DM-n` 섹션으로 담고, nullable/required는 IF 행이 소유한다(D3).**
3. **자동 덮어쓰기 금지.** 재실행은 diff-then-confirm. (단 §2.5 검증 게이트는 사용자 제시 *전* 초안 정제라 이 원칙 비적용 — 보호할 확정분이 아직 없음.)
4. **전역 규약 보존(lock).** 전역 규약은 API/데이터 교환 규약(에러포맷·ID·페이지네이션·인증·멱등성)에 더해 **URL 네이밍 컨벤션**(prefix·복수형 리소스·케밥케이스·표준 CRUD=HTTP 메서드·비-CRUD 액션=`POST /{resource}/{action}`)을 담는다(D1 — FE도 mock 경로 생성에 쓰므로 FE/BE 공통 게이트). 재실행 시 전역 규약은 재추론하지 않고 기존 값을 보존하며, SP/IF만 재추론·diff한다. 사용자가 "전역 규약 수정"을 **명시적으로 요청할 때만** §3 협의로 전역 규약을 변경한다.

## basedOnDefinition 마커 규격 (leaf ↔ 정의서 결속 SOT)
leaf spec(FE requirements.md · BE api-contract.md/requirements.md)이 "어느 정의서의 어느 버전에, 어떤 IF로" 결속됐는지를 한 마커로 담는다. `definitionPropagation`(추적기)의 입력 계약이다.

- **신규격(표준):** `<!-- basedOnDefinition: <상대경로>@v<N> | IF-a,IF-b,... -->`
  - `<상대경로>`: leaf에서 정의서(`definition.md` 또는 `definition.<slug>.md`)까지의 상대 경로.
  - `@v<N>`: 소비한 `definitionVersion` — `isStale(basedOnDefinition, currentVersion)`의 낡음 판정 기준(현재 버전이 크면 stale).
  - `| IF 리스트`: 이 leaf가 결속된 IF id들 — `computeImpacted`가 **보조 전파 소스**로 합산한다(본문 `<!-- from: -->` 역참조와 중복 제거). **`from:` 마커가 없는 FE 페이지 spec엔 이 리스트가 유일한 결속**(없으면 전파망 밖). IF가 없으면 `| ...` 생략 가능.
- **하위호환(구 정수형):** `<!-- basedOnDefinition: N -->` — `extractBasedOnDefinition`이 계속 읽는다(version만; path·IF 리스트 없음 → 전파 결속 없음, isStale만 동작). 신규 산출은 신규격으로 emit.
- **emit 주체:** dt-spec/dt-bespec의 게이트 통과 산출은 `buildSpecHeader({..., definitionVersion, definitionPath, definitionIfIds})`로 신규격을 emit(손 주석 주입 금지). 소급 부여(§1-b)는 dt-devspec이 직접 신규격으로 쓴다.

## 입력
- 멀티소스: Figma 페이지 URL(들) / PDF / 웹 링크 / Markdown. Figma 화면은 전부 받는다.
- `parseDefinitionSources.mjs`로 소스 파싱.
- **`--scope <slug>` (옵셔널 — 다중 스코프):** 전역 규약이 다른 독립 스코프(예: `backoffice`)를 분리하려면 지정한다. 지정 시 산출은 `docs/specs/definition.<slug>.md`, 미지정 시 종전대로 `docs/specs/definition.md`(=이름 없는 1번 스코프). `<slug>`=kebab.

## 실행 모드 (컨텍스트 경제 — 격리 워커 + needsDecision 협의)

이 스킬은 **얇은 조율자**다. 토큰 무거운 §1 발견·deep-read와 §1-b~§2.5 분석은 일회성 워커 `definition-author`(agents/)가 자기 컨텍스트에서 끝내고 **초안 + 협의 큐만** 돌려주게 하여, deep-read 토큰이 메인 세션을 부풀리지 않게 한다(불변원칙 1 토큰 가드의 일반화). 모드는 `../../docs/orchestration-policy.md` 원칙 1·4를 따른다.

- **dispatched (기본 — 서브에이전트 가용 시):**
  1. `Task`로 `definition-author` dispatch — `{ sources, --scope }` 전달. **워커가 §1~§2.5(발견·deep-read·역합치·경계추론·충실도검증)를 수행하고, §3 협의가 필요한 것은 직접 AskUserQuestion 하지 않고 `needsDecision`으로 모아 반환**하며 중간물을 `.dt-devspec/<scope>/`에 영속화.
  2. 조율자는 `{ artifacts(draft), needsDecision[], writingLint, summary }`만 받는다(deep-read 원자료는 워커에 격리). `needsDecision`이 있으면 **조율자가 §3 협의 AskUserQuestion**(아래 §3 규칙·기초→파생·군집화·큐 완전소진)으로 묻고 → 답과 함께 `definition-author`를 **재dispatch**(워커가 §3.5 점검 + §4 산출/갱신을 `.dt-devspec/<scope>/`에서 재개). 완료 보고의 summary 끝에 `한글 lint: 고침 N·유지 M`(writingLint)을 한 줄로 보인다.
- **inline degrade (원칙 4 — 서브에이전트 미지원 시):** 조율자가 아래 §1~§4를 **직접** 수행(현행 동작 — §2.5/§3.5는 종전대로 검증 서브에이전트만 격리). 워커를 안 거칠 뿐 **같은 절차·같은 산출**.

> 두 모드는 **아래 §1~§4 동일 절차**를 따른다(분기 없음). 사용자 채널(§3 협의 AskUserQuestion)은 **항상 조율자(메인)에만** — 워커는 needsDecision 반환만. `definition-author` 정의는 `${CLAUDE_PLUGIN_ROOT}/agents/definition-author.md`.

## 흐름
### 1. 발견 + 타깃 deep-read
- 각 Figma 소스: `get_metadata`에 **페이지 노드(예 0:1)** 를 줘 프레임 전체 트리(id·name·type·위치/크기)를 얻어 스크린을 발견한다(경량). 툴명 prefix는 환경마다 다를 수 있으니(예: `mcp__plugin_figma_figma__get_metadata`, `mcp__claude_ai_Figma__get_metadata`) **그 환경에서 dt-spec-analyze-figma가 쓰는 prefix를 그대로 따른다**.
- 발견된 각 **대상 스크린**(데이터 흐름·IF 후보가 있는 화면): 먼저 그 스크린 프레임을 `get_metadata`로 까 직속 자식 트리를 본다(이 팀 Figma는 화면이 [좌측 UI] + [우측 주석/규칙 글] 레이아웃).
  - **우측 주석 영역 식별 (position 1차, 3단계)**: ① 자식 중 **전폭 배너(width≈화면폭)·오버레이(작은 width로 좌측 UI span 내)를 먼저 제외** ② 남은 것 중 **최좌측의 큰 프레임을 좌측 UI로 보고 그 우측 경계(x+width)를 구함** ③ **그 경계 너머에서 시작하는 큰 단일 프레임**을 우측 주석 컨테이너로 고른다. (예 SCR_FLE_01: 배너·`Message` 제외 → 좌측 UI=`File_Mgt` 경계 2020 → 그 너머 `409:28220`(x=2100) 선택.) **name은 보조 참고만** — `Description` 등은 좌/우 슬롯에 다 나와 신뢰 못 함, 신뢰 신호는 **x-range**.
  - **식별 성공** → 그 컨테이너 노드만 `get_design_context`로 deep-read → 규칙 전문 확보(좌측 UI는 안 긁어 토큰 절감).
  - **식별 실패/불확실** → **스크린 프레임 통째로 `get_design_context` deep-read**(폴백). 트리거: 우측 주석 영역 없음 / 주석 없는 화면 / x좌표가 좌·우로 안 갈림(한 덩어리·세로 적층) / 우측이 여러 컨테이너로 쪼개져 경계 모호. **조금이라도 애매하면 통째**(규칙 유실 방지).
  - **호출 한도**: 대상 스크린당 **우측 주석 묶음 1회분**(또는 폴백 통째 1회). 분리 컨테이너가 **3개 이상**으로 많으면 차라리 통째 폴백.
  - 확보한 필터·정렬·쿼리 규칙을 IF 계약(인터페이스 합의)에 반영한다.
- 순수 정적·비데이터 스크린(IF 후보 없음)은 metadata로 충분 → deep-read 스킵.
- 문서 소스: 텍스트 파싱.

### 1-b. 역합치 입력 발견 (D12 — 흩어진 leaf·대충본 거두기)
정의서 없이 FE·BE가 각자 standalone 스펙을 만든 뒤 dt-devspec을 도는 경로를 위해, §1은 Figma·문서뿐 아니라 **기존 leaf 산출물·마커**도 입력으로 읽는다.
- **발견:** `parseDefinitionSources.discoverLeafSpecs({ projectRoot })`로 `docs/specs/{pages,resources}/*/`를 전수 스캔(사용자가 준 로케이터와 **합집합** — 흩어진 leaf를 빠짐없이). 각 항목 `role:'leaf-spec'` 태그(어댑터/머지가 일반 문서와 구분). **정의서 자신(`docs/specs/definition.md`)은 글롭 밖이라 별도 단일 입력**(in-memory 스냅샷; corrupt면 ③ 재추출). **자기참조 가드:** 발견 leaf의 `sources`에 `definition.md`가 박혀 있으면(unstructured 거절 힌트 흔적) 그 항목은 역합치 소스에서 제외.
- **세 입력 경로 구분(혼동 금지):** ① **구조화 standalone leaf**(IF/경로 있음) → **매핑 키 join**. ② **비정형 손작성 정의서**(`unstructured`, 산문/깨진 표) → join 불가 → 소스 텍스트 **재추출**(D11 정규화). ③ **깨진 generated(corrupt)** → 원본 백업(`definition.md.bak`)·재추출·롤백, `확정` 토큰은 §3 재확인 후보로만(무확인 복원 금지). join·3자충돌은 **①에만**.
- **매핑 키(①):** standalone leaf엔 `<!-- from: IF-n -->`가 없으니 join 키 = **메서드 + 정규화 경로**(폴백 기능명). 경로 달라 자동 매칭 실패(예: FE `POST /files/upload` ↔ BE `POST /api/v1/files`)면 §3 협의 큐(동일 IF 확정).
- **3자 충돌(①; 원본 vs FE standalone vs BE standalone):** 존재·기능 요구는 **원본 우선**(Figma=UX SOT, T7 정신), 계약면(경로·shape)은 **BE 우선**(D8), FE 최하위. 셋이 다르면 이 순서 1차 정렬 후 잔여 §3.
- **소급 `basedOnDefinition` + 마커 정리:** ① 역합치로 정의서 *처음* 생김 / ② unstructured→정식 SOT 승격이면, 입력 leaf들의 `<!-- definitionSOT: none|unstructured -->`·"일관성 미보증" 경고를 **제거**하고 `basedOnDefinition` 부여 — **위 「마커 규격」의 신규격**(`<상대경로>@v<N> | 기여 IF 리스트`)으로 쓴다(정수형 아님 — 정수형은 추적기가 경로·IF를 못 읽어 isStale·전파 결속이 끊긴다). 이번에 글롭된 leaf만, `@v<N>`은 이번 산출 definitionVersion, IF 리스트는 그 leaf가 기여/소비한 IF; 매핑 안 닿으면 §3 surface. 모두 diff-then-confirm.
- **마커 스캔:** leaf api-contract의 `<!-- conflict: IF-n -->`·`<!-- deprecate: IF-n -->` → T6/T8 재확인을 §3 큐에 적재. 정의서 상단 `<!-- NOT-SOT: ... -->`는 "정규화 시 제거 대상, 본문 단서 아님".
- **skipped 능동 제거(R6-A7):** T5로 해소·정식화된 IF를 참조하던 leaf 스펙의 stale `<!-- skipped: IF-n -->` 마커는 제거 대상으로 식별(diff-then-confirm) — 안 하면 implement가 거짓 `// TODO: 미구현` emit(leaf 소비측 stale 가드의 능동 제거 짝).
- **G3 지어내기 금지:** ②③ 재추출에서도 빈 곳은 `협의중`/`미해소`로 두고 §3에서 묻는다(API 계약을 지어내지 않음).

### 2. FE/BE 경계·인터페이스 후보 추론
- 화면·기능을 가로질러 책임을 `FE | BE | 공통`으로 분류(`confident | ambiguous`).
- 데이터를 주고받는 지점에서 인터페이스(엔드포인트) 후보를 뽑는다.
- **URL 경로 = 컨벤션에서 결정론적 도출(D1):** 전역 규약의 URL 컨벤션(§3에서 합의)에 각 IF의 리소스/액션을 기계 적용해 경로를 만든다(추측 아님). 예: 컨벤션 `prefix /api/v1·복수형·CRUD=메서드`면 이미지 목록 IF → `GET /api/v1/images`, 등록 IF → `POST /api/v1/images`, 비-CRUD → `POST /api/v1/images/{action}`. **컨벤션 미합의 시(첫 1.2 전환 등)엔 경로 도출 불가 → IF를 `협의중` 유지**(경로 도출되면 `컨벤션` 승격 — T1).
- **타입/nullable 출처 규칙(D6) — 환각 최위험:** 우선순위 ① 원본 명시값 → ② 기존 코드/ERD 추론(있으면) → ③ §3 협의(기능 그룹 단위) → ④ 못 풀면 미해소(D5). **결정론 도출 근거(컨벤션 같은)가 없으면 LLM 단독 단정 금지 — §3로 보낸다.** nullable/required는 DM이 아니라 *IF 행*에 방향(요청/응답)별로 둔다.
- **DM-n 공유 shape 추출(D3):** IF 요청/응답에 *실제 등장한* 핵심 엔티티의 필드명+기본 타입만 `DM-n`으로 담는다(추측 엔티티 금지). 예: `Image { id:number, titleKo:string, material:string }`. nullable/required는 DM이 아니라 IF 행이 방향별 소유. **DM↔IF 양방향 링크**(DM 행에 사용 IF id, IF 행에 참조 DM id) — shape 변경 시 영향 IF 추적. 풀 저장구조(테이블·인덱스·FK·관계)는 BE(dt-bespec) 소관 → 안 담음.
- **SP↔IF 양방향 링크(D2):** SP 행에 관련 IF id, IF 행에 from-SP를 명시. SP 변경 → 영향 IF를 기계 추적(`<!-- from: -->` 역참조 체계와 일관).
- **출처 deep-link(D10):** 각 IF 행에 deep-read 원본 **화면 프레임** node-id 링크 `https://figma.com/design/{fileKey}/{fileName}?node-id={node-id}`(`:`→`-`), 표엔 `[SCR_XXX_01](…)`로 슬림 표기. 다중 Figma 소스면 IF별 fileKey 보관(전역 단일 가정 금지). 비-Figma 출처(문서/PDF/웹)는 범용 표기(`app-spec.md §3.2`). IF 없는 순수 UI SP만 SP 행에 직접 링크(D2 폴백).

### 2.5 충실도·협의 완전성 검증 (자동 정제 게이트)
§2의 SP/IF 초안을 사용자에게 제시(§3)하기 **전**, §1에서 확보한 **입력 원본**(Figma=deep-read 텍스트 / 문서=파싱 텍스트 / 혼합=둘 다)을 ground truth로 삼아 산출물 충실도와 협의 완전성을 검증·자동 정제한다.
- 이 단계는 **사용자 제시 전 초안 정제**라 불변원칙 3(자동 덮어쓰기 금지)의 적용 대상이 아니다(보호할 확정분이 아직 없음). 확정/협의중 lock(leaf의 `### 0. 개발 정의서 게이트` 개념)도 dt-devspec과 무관.
- 입력에 Figma가 없어도(문서만) **스킵하지 않는다** — 원본 출처만 바뀐다.

**dispatch·주입.** dt-devspec(메인 스킬)이 아래 프롬프트를 입력 원본·초안과 함께 `Task` 본문에 **인라인으로 실어** 검증 서브에이전트를 띄운다(서브에이전트는 이 SKILL.md를 자동으로 읽지 않으므로 프롬프트 본문을 직접 전달). Task 병렬 실행 메커니즘은 dt-spec-generate-spec [3]의 어댑터 병렬 dispatch와 동일.
- **토큰 가드**: 입력 원본이 큰 경우 A/B Task에 **대상 스크린/섹션 단위 청크**로 원본을 실어 토큰 폭발을 막는다(라운드당 3회 × 최대 2라운드이므로 — 불변원칙 1의 deep-read 토큰 가드와 동일 취지).

**라운드 절차 (최대 2라운드):**
1. **1차 — 병렬 2개 Task** (A∥B; B는 A의 출력을 소비하지 않으므로 병렬 안전):
   - **A 충실도** — StructuredOutput `{ missing: [{item, evidence}], distorted: [{item, draftValue, originalValue, evidence}], hallucinated: [{item, reason}] }`.
   - **B 협의완전성** — StructuredOutput `{ silentlyDecided: [{topic, assumed, evidence, options}], missingQuestions: [{topic, why, options}] }`. **검증 항목에 SP↔IF 소유권 교차를 포함**: 정렬·필터·페이지네이션 등 규약의 담당(FE/BE)이 SP 분담 문구와 IF 행에서 모순되지 않는지(예: SP "정렬=FE" vs IF "최신순"=BE — 모순이면 missingQuestions로) <!-- from: audit 2026-07-24-spec SB-2 재발 방지 -->.
2. **머지·dedup** — A·B 결과를 합치고 같은 대상(같은 SP/IF/주제)을 가리키는 중복 제거.
3. **2차 — 교차확인 1개 Task (refute)** — 입력=머지 결과+원본. StructuredOutput `{ accepted: [...], rejected: [{item, reason}] }`. 원본 근거로 반박돼 떨어진 항목(rejected)은 버리고 `accepted`만 채택.
4. **자동 정제 적용** — `accepted` 중 자동 대상(아래 표)을 초안에 반영하고 정제 로그를 정의서 `## 변경 추적`에 기록.
5. **재검증** — 정제 후 1~4를 1회 더(총 **최대 2라운드**). 후에도 남은 미해소·모호 항목은 §3 큐로 넘긴다.

**자동 정제 차등 (정의서 섹션별):**
| 섹션 | 자동 정제 (사용자에게 안 물음) | §3 큐로 (사용자에게 물음) |
|---|---|---|
| **IF** | 누락→채움 / 왜곡→원본 값 교정 / 환각→제거 (ground truth=입력 원본) | 2라운드 후에도 자동 못 푼 IF |
| **SP** | **명백한** 누락·오분류만 채움 | **모호(ambiguous) 분담** |
| **전역 규약** | 없음 (lock 보존, 불변원칙 4) | 단서 발견 시 제안만 |
| **변경 추적** | 대상 아님 | — |

**검증 프롬프트 (Task 본문에 원본·초안과 함께 주입):**

*A — 충실도*
> 너는 산출된 정의서 초안이 입력 원본에 충실한지 검증한다. 원본을 ground truth로 삼아 초안의 각 SP/IF 항목을 대조해 (1) **누락**=원본엔 있는데 초안에 빠진 규칙/파라미터, (2) **왜곡**=원본과 초안 값이 다름, (3) **환각**=원본 근거 없이 초안에 생긴 항목을 찾아라. 각 항목에 원본 근거(인용)를 붙여라. 추측 금지 — 원본에 명시된 것만 보고하라. 결과를 지정 스키마로 반환하라.

*B — 협의 완전성*
> 너는 "사람이 결정해야 할 것"을 dt-devspec이 빠짐없이 물었는지 검증한다. ① **원본만 보고** "사람이 결정해야 할 모호·미결 지점"(책임 분담이 갈릴 수 있는 것, 미확정 계약 등)을 먼저 추출하라. ② 그 지점이 초안에서 임의로 단정됐는지(`silentlyDecided`) 또는 협의 질문 초안에 없는지(`missingQuestions`) 대조하라. ③ **`references/handoff-checklist.md` 협의 항목 카탈로그**(TOP5 + 14범주)를 기준으로, **이 프로젝트에 관련 있고 정의서(전역 규약/IF/DM)가 아직 커버 안 한** 항목을 `missingQuestions`로 추가하라(14항목 전부 강제 아님 — 과부하 방지; 정의서가 이미 같은 항목을 명문화했으면 미커버 아님이 1차 규칙). 각 항목에 원본 근거와 가능한 옵션을 붙여라. 결과를 지정 스키마로 반환하라.

*refute — 교차확인*
> 너는 1차 검증이 보고한 항목이 진짜인지 반박한다. 각 항목에 대해 원본 근거로 "이건 사실 누락/왜곡/환각/모호가 **아니다**"를 입증하려 시도하라. 반박에 실패한(=진짜인) 항목만 `accepted`, 반박에 성공한 항목은 `rejected`(사유)로 분류하라. **기본은 의심** — 원본 근거가 약하면 reject. 결과를 지정 스키마로 반환하라.

### 3. 협의·확정 (askQuestion)
- ambiguous 분담, 전역 규약(에러포맷/ID타입/페이지네이션/인증/멱등성/URL 컨벤션), IF 합의 상태를 사용자에게 질문해 확정.
- **질문 순서(기초→파생):** §3 질문은 **기초→파생** 순으로 정렬한다 — ① 전역 규약(URL 컨벤션·인증·ID 타입·페이지네이션·에러 포맷·멱등성) ② 권한/역할 모델 ③ FE/BE 분담(SP) ④ IF 세부(필터·정렬·요청/응답 shape). 기초(전역 규약·권한)를 먼저 확정하면 파생 항목이 자동 해소돼 미해소 잔존이 준다(폐기한 "미해소 재질문 사이클"의 대체).
- **IF 합의 상태 = 4단계:** `확정`(합의 완료·lock) / `컨벤션`(컨벤션서 도출된 기본 경로/값) / `협의중`(잠정 — 형태만, 경로 미정) / `미해소`(계약 자체 없음). **`확정`은 생성 시점에 만들지 않는다**(dt-devspec 확정 권한 없음 — BE 확정으로만 도달, T1).
- **미해소는 물음 후 잔여(D5):** 식별된 IF/SP는 정보가 없어도 §3에서 **반드시 한 번** 묻는다("정해진 거 있으세요? 없으면 미해소로 둡니다"). 답 없을 때만 미해소 마킹 — **조용한 미해소 금지.** 2상태: `미해소(미질문)`=다음 §3에서 물음 / `미해소(질문완료)`=재실행 시 스킵(사용자 "다시 물어줘"·원본 새 단서 시 재질문). 경계: 요청/응답 형태가 하나라도 잡히면 `협의중`(경로만 미정), 형태조차 없으면 `미해소`.
- **재실행 시 전역 규약은 보존(lock)** — 사용자가 명시적으로 수정 요청하지 않는 한 전역 규약은 묻지 않고 기존 값을 유지한다(불변원칙 4).
- **AskUserQuestion 작성 원칙**: 모든 질문은 ① 왜 묻는지 배경 ② 어느 항목(SP/IF/전역 규약)에 반영되는지 ③ 각 옵션의 구체적 의미·결과·예시를 담는다. 짧은 질문 한 줄 + 라벨만 있는 옵션은 금지(기존 dt-spec-generate-spec 규약과 동일).
- **§2.5 검증 큐 합류·소진**: §2.5가 넘긴 미해소 큐(모호 SP 분담 · 2라운드 후 미해소 IF · 전역 규약 단서)를 위 원래 질문과 **머지·dedup**해 함께 묻는다. **미해소·모호 항목은 기능 그룹 단위로 군집화**해 한 `AskUserQuestion` 콜에 **최대 4블록**까지 채운다(여기서 '블록'='질문' — 기존 "최대 4개 질문"과 동일 단위). **항목당 단일 질문(1블록=1항목) 금지** — 관련 항목은 반드시 한 화면에 묶는다. 같은 답 공간이면 한 블록 `multiSelect`, 각자 다른 답이면 별 블록. 5블록 이상이면 다음 콜로 이어가되 여전히 블록을 꽉 채운다. 단, 군집화할 관련 항목 없이 **딱 1개만 남으면 단독 블록 허용**(금지 규칙의 예외). **큐가 완전히 빌 때까지 §3를 끝내지 않는다**(조용한 누락 불가). 사용자가 중간 중단하면 남은 항목은 "미해소"로 표시 + `status: draft`(아래 `## 상태 결정`).

### 3.5 협의 후 경량 점검 (사용자 답변 일관성 — verifyModel 서브에이전트)
§3 협의가 끝나(큐 완전 소진) **§4 산출 직전**, 사용자가 §3에서 확정한 답변이 일관적인지 **다른(더 싼) 모델 서브에이전트**로 점검한다. **충실도(누락/왜곡/환각)는 보지 않는다 — 그건 §2.5 소관(중복 금지).** 오직 셋만 본다:
1. **전역 규약 위반** — 답변이 *잠긴* 전역 규약(URL 컨벤션·에러포맷·ID·페이지네이션·인증·멱등성)을 깨나.
2. **답변 간 상호 모순** — 사용자 답변들끼리 충돌하나(예: 권한 role 집합 불일치, 정렬 키가 DM 필드에 없음).
3. **원본과 충돌** — 답변이 §1 입력 원본(Figma deep-read/문서)과 어긋나나. (§2.5 A 충실도가 *LLM 초안*을 원본 대조한 것과 달리, 여기는 **사용자 답변**이 원본과 어긋나는지를 본다 — 검사 대상이 다름.)

**dispatch·모델.** §3 큐가 **완전히 소진된 직후**(마지막 AskUserQuestion 응답 수신 후) 메인이 `Task`로 **검증 서브에이전트 1개**를 dispatch한다(§2.5와 동일 인라인 주입 — 서브는 이 SKILL을 안 읽으므로 프롬프트 본문에 다 전달). 본문에 **[§3 확정 답변 전체(여러 라운드 누적) + 전역 규약 *lock 상태*(잠긴 필드 목록·값) + 4상태 라벨 의미 + §1 원본 요약]**을 주입한다.
- **모델 = `verifyModel`(기본 `sonnet`)** — 메인 세션 모델과 **독립 지정하는 노브**(주목적: 비용·비례). 메인과 다른 모델일 때 다른 맹점으로 상관된 실패가 주는 건 부가 효과(메인 모델은 세션마다 달라 보장 아님). 오버라이드: `haiku`(초경량) / `fable`(실험적 max-diversity).
- **토큰 가드:** §3.5는 단일 Task라 §2.5(A/B 병렬 분배)와 구조가 다르다 — 원본이 한도를 넘으면 **타입 1·3만 섹션 단위로 §3.5 Task를 순차 반복**해 violations를 머지. ⚠ **타입 2(답변 간 모순)는 전체 답변을 한 컨텍스트에서 봐야 잡히므로 섹션 분할 대상이 아니다** — 답변 목록을 **그대로 직렬화**해 단일 Task에 주입(요약 금지 — 요약 중 놓친 모순=거짓음성; 컨텍스트 한도를 *진짜* 넘을 때만 압축).

**출력(StructuredOutput):** `{ violations: [{ type: 'convention'|'contradiction'|'source-conflict', items: string[], evidence: string, suggestion: string }], forceDraft?: boolean }` — `forceDraft`는 2회차 후에도 위반이 남을 때 `true`(→ §4 status draft 강제).

**결과 처리(메인 세션이 수행 — 서브는 violations만 반환).**
- **위반 없음** → §4 진행.
- **위반 있음(같은 세션 내 즉시 처리)** → 걸린 항목만 §3을 **같은 실행 내에서 재개**해 콕 짚어 재질문한 뒤 §4로 진행(전체 재사이클 ❌, 다음 재실행으로 미루지 않음). 메인 시퀀스: ① 걸린 IF/항목을 `미해소(미질문)`로 재마킹 → ② 그 항목만 §3 큐 재추가 → ③ §3 재진입(AskUserQuestion) → ④ 큐 소진 후 §4 진행.
  - **비목표와의 구분:** 이는 폐기한 "미해소 재질문 사이클"(정보 無 *전체* 재질문)과 다르다 — **검출된 불일치라는 새 단서를 근거로 *걸린 항목만*** 재질문하는 타깃 재개다.
  - **`확정` 충돌(lock 보호):** §3.5는 `확정`을 **직접 못 바꾼다**. 위반이 기존 `확정` IF를 건드리면 **T6(확정 개정) 경로**로 §3 큐에 올려 **사용자 명시 동의 후에만** 변경(불변원칙 4 lock 유지). (생성 시 `확정`은 안 만들어지므로 이 케이스는 *기존 정의서 재실행 소비* 시 한정.)
- **루프 방지·draft 전달:** §3.5 **재점검은 최대 1회**. 2회차에도 남은 위반은 해당 항목을 **`미해소(질문완료)`**로 표기 + **§3.5 출력에 `forceDraft: true`**를 실어 §4가 `buildDefinitionHeader`를 `status:'draft'`로 호출하게 강제한다(아래 §4 "§3.5 forceDraft 처리" 분기). `## 변경 추적`에 점검·재질문 로그를 남긴다.

**§2.5 관계:** §2.5(협의 *전* 충실도·협의완전성)는 **현행 유지**. `verifyModel`은 §2.5와 공유하나 §2.5 기본값은 변경하지 않는다(opt-in 노브로만 — shipped 품질 회귀 방지).

**§3.5 검증 프롬프트(초안 — Task 본문에 §3 답변·lock 상태·원본과 함께 주입):**
> 너는 사용자가 §3 협의에서 확정한 답변이 일관적인지 점검한다. **충실도(누락/왜곡/환각)는 보지 마라 — 그건 §2.5 소관이다.** 오직 셋만 본다: (1) **전역 규약 위반** — 답변이 아래 *잠긴* 전역 규약(제공된 필드·값 목록)을 깨는가, (2) **답변 간 모순** — 확정 답변들끼리 충돌하는가(예: 권한 role 집합 불일치, 정렬 키가 DM 필드에 없음), (3) **원본 충돌** — 답변이 제공된 원본과 어긋나는가. 각 위반에 근거(인용)와 수정 제안을 붙여라. 위반 없으면 빈 배열. 지정 스키마로 반환하라.

### 4. 산출/갱신
- `buildDefinitionHeader.mjs`로 5~6줄 헤더 생성 (신규=definitionVersion 1, 재실행=diff 있으면 +1; **scope 있으면 6번째 줄 `<!-- scope: <slug> -->` emit**, 없으면 5줄).
- **스코프 산출 경로(다중 스코프):** `--scope <slug>`(또는 명시 입력)이면 `docs/specs/definition.<slug>.md`에 쓰고 헤더에 `scope` 마킹한다. **다른 스코프 파일은 절대 덮어쓰지 않는다** — 산출 경로는 `definition.<해당scope>.md`로 고정(오늘 Back Office가 Front Service `definition.md`를 덮어쓴 버그 직접 수정). 스코프 미지정이면 종전대로 `definition.md`.
- **§3.5 forceDraft 처리:** §3.5가 `forceDraft: true`를 반환했으면 `buildDefinitionHeader`를 `status:'draft'`로 호출한다(시그니처 불변 — `status` 값만 `draft`).
- 본문: 전역 규약(+URL 컨벤션) / 범위 분담(SP-n, `관련 IF` 컬럼) / 인터페이스 합의(IF-n, `합의 상태`·`참조 DM`·`출처` 컬럼) / **데이터 모델(DM-n, 옵셔널 — IF 응답에 실제 등장한 공유 shape만)** / 변경 추적.
- **재실행**: 기존 `docs/specs/definition.md`와 비교(diff-then-confirm). **전역 규약은 보존(lock)** 하고 바뀐 SP/IF만 갱신하며, 변경이 있으면 definitionVersion +1. 사용자 승인 후 저장. (전역 규약 변경은 사용자가 "전역 규약 수정"을 명시 요청할 때만 — 불변원칙 4)
- 저장 직후 `validateDefinition.mjs`로 자체 검증.
- **1.1→1.2 마이그레이션(D7, 재실행):** ① `parseDefinitionHeader`로 구버전/specVersion-미상 감지(헤더 옵셔널 파싱은 완료됨). ② 전역 URL 컨벤션 미합의면 1차 전환에서 경로 도출 불가 → 기존 IF 전부 `협의중` 유지(컨벤션 SOT가 이 §3에서 *처음* 합의됨). ③ §3 컨벤션 확정 → §4 경로 재도출 → 경로 얻은 IF만 `협의중`→`컨벤션` 승격. ④ 기존 `확정` lock 보존(재실행이 되돌리지 않음). ⑤ 신규 섹션/필드(DM·링크·출처)는 "구조 추가"로 한 묶음, 기존 SP/IF 본문 diff와 분리 제시(diff 폭발 방지). ⑥ 승인 후 `definitionVersion`+1·specVersion 1.2 bump. **즉 컨벤션 합의→경로 재도출→승격 순서 의존이라 1차 전환 직후 `컨벤션` 라벨이 0이어도 정상.** ⑦ 입출력 동일 경로 가드: §1에서 in-memory 스냅샷으로 읽고, §4 출력은 temp→원자적 rename(실패 시 원본 유지).

## 상태 결정 (status)
헤더 `<!-- status: ... -->`는 `buildDefinitionHeader`의 `status` 인자로 결정한다:
- **`finalized`** — §2.5 검증 큐 항목을 §3에서 모두 해소(또는 큐가 애초에 없음)했고 검증을 통과한 경우.
- **`draft`** (다음 중 하나):
  - §3 `AskUserQuestion` 중간 중단으로 §2.5 큐에 **미해소 항목이 잔존**.
  - §2.5 **2라운드 후에도 자동 못 푼** IF/SP가 §3에서도 미확정.
  - §3.5 **재점검 1회 후에도 남은 위반**(전역 규약/모순/원본 충돌) — 해당 항목 `미해소(질문완료)` + `forceDraft: true`.
  - §4 `validateDefinition` 자체 검증 **실패분을 사용자가 안 고침**.
- draft는 헤더 메타에 남아 — dt-spec/dt-bespec 게이트가 인식해 경고할 수 있다(미해소 항목은 정의서 본문에 "미해소"로 명시).

## 능동 요약 알림 (산출/소비 실행 종료 시 1줄)
산출물을 내거나 standalone 소비한 실행이 끝날 때 한 줄 요약을 띄운다(재실행은 권유 — 자동 호출 X). 미산출 종료(corrupt/versionTooHigh/공집합 등)는 D11 원인 맞춤 라우팅으로 갈음(이 알림 비적용).
- **nag(⚠ — 자연 수렴 경로 없음):** SOT 미해소 잔존(=draft) → `⚠ 미해소 N건·draft — IF-7, IF-12 … · /dt-devspec 재실행 권장`. (dt-devspec은 자기 SOT 미해소만, 전체 SOT 기준)
- **info(ℹ — 자연 수렴 경로 있음, nag 아님):** `협의중`/`컨벤션` 잔존 → `ℹ 협의중/컨벤션 M건 — BE 상향정합(T2/T3) 시 확정됨`. 미해소 0이어도(첫 1.2 전환처럼 전부 잠정) 반쪽 계약 가시화.
- **결합:** 둘 다면 한 줄에 ` · `로 병기.

> leaf측 능동알림(standalone nag 고정문·consume info 자기-의존 IF 필터)은 Stage 2에서 dt-spec/dt-bespec에 배선.

## 비고 칸 규칙(슬림)
범위 분담 비고는 "FE/BE 분담 근거 한 줄"만. 구현 상세 금지.

## 활성화 조건
새 프로젝트·기능을 시작할 때 `/dt-devspec` 명시 호출. 정의서는 FE/BE 분담의 상위 SOT라 `.dt-frontend.json`/`.dt-backend.json` 같은 스택 마커보다 먼저 올 수 있으므로 마커를 전제하지 않는다.

> 후속 단계와의 관계: dt-spec·dt-bespec은 정의서가 있으면 게이트에서 소비하되, 없거나 엉성해도 막히지 않고 소프트 게이트로 분기한다 — 단 정식 SOT가 있을 때만 FE/BE 일관성이 보증되므로 작업 전 dt-devspec으로 정의서를 만들어 두길 권장한다. (dt-spec/dt-bespec의 존재가 dt-devspec의 실행 조건인 것은 아니다.)
