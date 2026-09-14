---
name: dt-implement
description: Use when the user wants to turn dt-spec page artifacts (requirements/design/tasks/layout-skeleton in docs/specs/pages/<page>/) into code. Reads the spec, maps it to a ScaffoldSeed, and delegates code generation to the dt-frontend-scaffold engine. Single-domain pages fully; multi-domain pages compose domain components into one layout page.
---

# dt-implement — spec→scaffold 다리

dt-spec 산출물을 읽어 dt-frontend-scaffold 엔진에 위임해 코드를 생성한다. dt-scaffold standalone 동작은 건드리지 않는다.

## 입력
- `<specDir>` (필수): `docs/specs/pages/<page>/` (requirements/design/tasks/layout-skeleton 4종)

## 절차

### [1] 매핑
1. `import { parseSpecForScaffold } from '<plugin>/scripts/parseSpecForScaffold.mjs'`.
2. 호출부에서 `src/business/hooks/`와 `src/store/queries/`를 스캔해 `existingDomains: string[]`를 만든다.
3. `parseSpecForScaffold(specDir, { existingDomains })` → `ScaffoldSeed`(status/page/domains/multiDomain/draftFlags).
4. 결정적이지 않은 부분은 **문서를 직접 읽어** 채운다:
   - design.md `## 데이터 모델 / API 계약` → 각 도메인 contract(ViewModel/DTO 타입, API method/endpoint/schema).
   - design.md `## 컴포넌트 구조` + layout-skeleton.md(`domain-boundary`/leaf placeholder) → componentHints(domain/view, 어느 구역). **표시 전용 composite(GNB/Toast)는 View 후보.**
   - design.md `## 에셋 매니페스트`(있으면) → `docs/specs/assets/<page>/`의 실제 파일을 프로젝트 컨벤션대로 `src/assets/<page>/`(import) 또는 `public/`로 물질화하고 실제 `<img src>`/SVG import를 배선(플레이스홀더 금지). 매니페스트 `(미수거)` 항목만 TODO 허용. asset URL 만료로 파일이 없으면 헤더 `sources`의 `figmaFileKey`로 재수거 가능.
   - requirements FR + tasks 완료기준 → 도메인별 테스트 기준.

### [2] draft 확인
`ScaffoldSeed.status === 'draft'`이거나 `draftFlags.proposedApiCount > 0`이면 AskUserQuestion 1회:
- `question`: "이 스펙은 draft이고 API 계약 N개가 제안값입니다. 그대로 진행할까요? 제안 계약은 `// TODO: 백엔드 확정 필요 (spec [제안])` 주석과 함께 코드로 들어갑니다."
- options: `"진행"` / `"중단"`.
진행 시 제안 계약을 contract.ts/타입에 그대로 쓰되 위 TODO 주석을 부착하고, 커밋 노트에 "spec draft 기반 — API 미확정" 표기.

### [2.5] 부분성 마커 소비 (침묵 누락 금지)
스펙 본문(requirements/design/layout-skeleton)의 부분성 마커를 스캔해 코드 생성에 전파한다 — 조용히 빠뜨리지 않는다:
- `<!-- skipped: IF-n (미해소) -->` (그 IF를 참조하는 FR/기능 자리): 해당 기능을 **빈 stub + `// TODO: 미구현 (IF-n 미해소 — 정의서 계약 미확정; /dt-devspec로 해소 후 재생성)`**로 생성하도록 그 도메인 Phase 2 dispatch 발췌에 명시.
- `<!-- partial: ... -->` (정의서 미수거 경고): 영향 도메인 발췌에 "이 영역 계약 일부 미수거 — 해당 호출부에 TODO 표기, 임의 추론 금지"를 포함.
- **provisional 신호:** `협의중`/`컨벤션` 합의상태 기반으로 만든 mock/타입엔 `// provisional: spec 협의중 — BE 상향정합(T2/T3) 시 확정` 주석 + 커밋 노트 표기(이것은 [2]의 `proposed`(draft 헤더)와 **별개 축** — provisional은 정의서 IF 합의상태 기반). **동일 IF에 `skipped`(미해소→stub)와 `provisional`(잠정)은 공존하지 않음 — 미해소면 stub, 잠정이면 provisional.**
- **stale 가드(거짓 TODO 방지, 필수):** 마커 발견 시 현 `docs/specs/definition.md`를 **1회 조회**해 그 IF가 **여전히 미해소/미수거면** 위 TODO emit, **이미 해소(T5)·정식화됐으면 stale로 보고 emit 억제**(마커 제거가 아직 안 돈 창에서 거짓 `// TODO: 미구현` 방지). 정의서가 없으면(standalone) 마커 그대로 emit.
- 완료 보고([6])에 **미구현 마커 N건(IF 목록)**을 명시한다.
> 마커 *능동 제거*(해소된 IF의 stale 마커 삭제)는 leaf 재실행 재생성·dt-devspec §1 스캔(후속) 소관 — 소비 측은 위 stale 가드로 거짓 TODO만 억제하고 삭제는 하지 않는다.

### [3] 도메인 분기
- `multiDomain === false`(단일): 바로 [4].
- `multiDomain === true`: 감지한 도메인 목록을 보여주고 AskUserQuestion:
  - `"전체 조립 (추천)"` — 도메인 전부 + 페이지 1회 조립([4]+[5]).
  - `"하나만"` — 주요 도메인 1개만 단일 흐름.
  - `"중단"`.
  - **강결합 주의**: 한 도메인 컴포넌트/훅이 다른 도메인의 store/hook을 import해야 하면(예: 추천에서 팔로우 토글), 사용자에게 알리고 공유 상태/콜백 배선을 확인.

### [3.7] 코드-레벨 플랜 생성 (plan-author, opus) — 구현 직전
스펙이 finalized면 `docs/specs/pages/<page>/plan.md`(코드-레벨 체크박스 플랜)를 확보한다. 반환 `needsDecision`이 있으면 AskUserQuestion 후 재dispatch. **사용자 플랜 승인 게이트** 후 [4]로. plan-author는 durable 3겹의 셋째 — `definition → spec → plan`.
- **홀리스틱(권장 — 여러 페이지):** `plan-author`(opus)를 **전 페이지를 한 번에** dispatch(`units`=페이지 목록, `stack:frontend`)해 `interactions.md`를 함께 읽고 **크로스페이지 배선(`[X]`)** 까지 유닛별 plan.md에 박게 한다. dt-fullstack에서 오면 이 홀리스틱 plan이 이미 생성돼 있으니 **재생성 생략**하고 plan.md를 그대로 쓴다.
- **단일 페이지 standalone 호출:** 그 페이지만 plan-author dispatch(interactions.md 있으면 함께 전달). plan.md가 이미 있고 최신이면 재생성 생략.

### [4] 도메인별 위임 (Phase 1~4) — fe-builder가 plan 실행
각 도메인에 대해 checklist(`dt-frontend-scaffold/checklist/new-domain.md` 또는 `extend-domain.md`)의 **Phase 1~4**를 따라 **`fe-builder`(model: sonnet)를 Task로 dispatch**한다(페이지 작성 Phase 5는 [5]에서 일괄). **dispatch 시 `plan.md`(크로스페이지 `[X]` 배선 포함) + `docs/specs/interactions.md`를 함께 전달**한다. fe-builder는 **plan.md 체크박스가 있으면 그대로 실행**(크로스페이지 무효화 배선 포함), 없으면 스펙 + `dt-frontend-architecture` 룰대로 구현. 레이어별 prompt는 없음(통합됨). dispatched 미지원이면 inline degrade(조율자 직접).

> project-context의 `## 프로젝트 기술/라이브러리` 항목은 fe-builder dispatch 시 함께 전달해, 전역 기본 세트보다 우선 채택한다.

### [5] 페이지 조립 (전체 1회)
- 단일 도메인: 해당 도메인의 checklist Phase 5(page+router)를 그대로 수행.
- 다중 도메인: `dt-frontend-scaffold/checklist/multi-domain-assembly.md`(있을 때) 절차로 레이아웃 View 슬롯에 도메인 컴포넌트를 꽂아 페이지 1회 작성 + 라우트 1개. (해당 절차가 아직 없으면 [3]에서 "하나만"으로 유도)
- **홈 라우트 규칙(필수):** 라우터 등록은 checklist Phase 5의 "라우트 등록 규칙"을 따른다 — spec이 이 페이지를 앱 진입점/메인(메인 피드·홈·대시보드 등)으로 식별하면 `/feed` 같은 하위 경로가 아니라 **`/`(index)로 등록**한다. 어느 페이지가 홈인지는 requirements/design의 "메인/진입 화면" 표기로 판단하고, 모호하면 사용자에게 1회 확인한다. 라우터엔 항상 `/`가 1개 존재해야 한다(빈 루트로 404 금지).

### [6] 게이트/완료
dt-scaffold의 게이트(tsc/vitest/리뷰)와 완료 처리를 그대로 따른다. + [2.5]에서 감지한 미구현 마커(skipped/partial)·provisional 항목을 완료 보고에 "N건 미구현(IF 목록) — /dt-devspec 해소 권장"으로 명시.
- 수용 e2e 넛지: "이어서 `/dt-e2e`로 수용 e2e 시나리오를 작성·검증할까요?" — 자동 실행하지 않고 사용자 승낙 시 dt-e2e로 진행. (구현 완료 페이지의 스펙을 근거로 함)

## 경계

> 실행 모드(병렬/순차)·리뷰 격리는 scaffold가 따르는 `../../docs/orchestration-policy.md`를 그대로 상속한다. 다중 도메인 "범위" 질문과 별개로 실행모드 선택이 노출된다.

- dt-implement는 **논리 입력(seed)과 순서**만 정한다. 실제 파일 경로·5-layer 배치·컴포넌트 명명·페이지 작성·router 등록은 dt-scaffold가 수행.
- dt-scaffold/dt-spec의 기존 동작은 변경하지 않는다.
