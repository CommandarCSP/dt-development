---
name: dt-audit
description: Use when auditing whether the implemented app (static code + running app) satisfies dt spec artifacts — extracts as-built spec per track(fe|be|ux), diffs against docs/specs (definition.md·pages·resources), detects git-based spec→code drift, and emits an action-oriented audit report to docs/audits/. Triggers on "스펙 감사", "구현이 스펙대로 됐는지", "스펙 드리프트 찾아줘", "/dt-audit". Read-only(진단만) — dt-review(아키텍처 룰)와 별개로 스펙 충족만 판정.
---

# dt-audit — 스펙↔구현 정합 감사 리포트

> 산출물: `docs/audits/YYYY-MM-DD-<scope>/report.md` + `traceability.md`. 설계 SOT:
> `docs/superpowers/specs/2026-07-24-dt-audit-design.md`. 방법론: spec-kit converge(인텐트
> 인벤토리·gap 분류) + Reversa(신뢰도·traceability) + 자체 git 드리프트 축.

## dt-review와의 경계
dt-review/dt-be-review는 "코드가 **아키텍처 룰**을 지키나"(review.mjs 기계 검사), dt-audit은
"코드가 **스펙**을 충족하나"(역추출→diff→git 드리프트)를 본다. 아키텍처 룰 위반은 재검사·중복 보고하지 않는다.

## 불변 원칙
1. **읽기 전용 감사.** 쓰기는 `docs/audits/<run>/`로만. 코드·스펙·tasks를 절대 수정하지 않는다 — 수정은 리포트의 권고로만.
2. **스펙이 정의한 범위로 바운드.** 워커의 code-scope map 밖 추론 확장 금지(undocumented용 표면 스캔만 전역 허용).
3. **원자료 격리.** 무거운 분석은 auditor 워커 컨텍스트에 가두고 조율자는 반환 계약만 수신(`references/finding-schema.md`).
4. **낡은 기준으로 확정 판정 금지.** 기준 스펙이 basedOnDefinition stale이면 findings에 stale 플래그 병기.

## 입력
`/dt-audit [--scope fe|be|ux|spec|all] [--page <p>] [--resource <r>] [--app-url <url>] [--consult]` — 무인자 = 자동 트랙 판별 전체 감사 + 리포트 후 협의 여부 1회 질문. `--consult`는 질문 없이 협의 루프까지 진행, `--scope spec`은 구현 없이 문서 전수 대조만.

## 실행 흐름

### §0 게이트
- 스펙 인벤토리 수집: `docs/specs/definition.md`(있으면) + `pages/*/requirements.md` + `resources/*/api-contract.md`.
  **leaf 스펙이 하나도 없으면 중단** — "감사할 기준 스펙이 없습니다. /dt-spec·/dt-be-spec을 먼저 실행하세요."
- 프로젝트 루트 판별: `.dt-frontend.json` / `.dt-backend.json` 마커로 자동 탐지(모노레포 대응). 못 찾으면 1회 질문.
- ux 트랙 대상인데 `--app-url`이 없거나 접근 불가(fetch 1회 실패)면 **ux만 skip** — 리포트에 "UX 감사 미수행(사유)" 명시. 전체 실패로 만들지 않는다.
- 증분 시드: `docs/audits/`의 최신 run에서 traceability.md를 찾아 `priorTraceability`로 전달.
- **미결 확인**: `docs/audits/pending.md`가 있으면 읽어 미결 N건을 §4 협의 큐 최상단에 올린다.
- **멀티루트 runDir**: FE/BE가 별도 프로젝트 루트면 — 같은 git 레포일 때 **레포 루트의
  `docs/audits/`**, 레포가 다르면 **정의서 원본 소유 루트**. traceability·evidence의 파일
  참조는 `fe:`/`be:` prefix + 각 projectRoot 상대 경로로 표기해 모호성을 없앤다.

### §1 모드 확인 + dispatch (orchestration-policy 원칙 1)
- 대상 트랙: `--scope` 없으면 자동 — FE 스펙+마커 → fe, BE 스펙+마커 → be, 앱 접근 가능 → ux.
- **spec 트랙**: 정의서 + leaf 스펙이 2개 이상이면 기본 포함(코드 불필요 — fe/be와 병렬).
  1회차 실증: finding 6건 중 2건이 문서 간 모순이었다(작성 게이트의 사후 전수 재검 쌍).
- AskUserQuestion 1회: "감사는 N개 트랙으로 나뉩니다(추천: 병렬 — 읽기 전용이라 충돌 없음). 병렬(추천)/순차/자동".
- 트랙별 `auditor`(agents/) dispatch — 전달: `{ track, specInventory, projectRoot, scopeFilter, appUrl?, priorTraceability?, runDir }`.
  `runDir`은 미리 정한다: `docs/audits/YYYY-MM-DD-<scope>/`(중복 시 `-2` 서픽스).

### §2 병합 + 크로스스택 판정 (조율자 직접 — 유일한 분석)
- 워커 findings 병합, `A-###` id 부여(severity 내림차순), 같은 sourceRef+evidence 중복은 근거 합쳐 1건으로.
- **FE 호출면 ↔ BE 표면 조인**: 두 워커의 `surface`를 IF-ID(없으면 method+path)로 조인 — 한쪽에만 있으면
  track=cross finding(`missing` 또는 `mismatch`).
- **정의서 체인**: 워커들의 `staleSpecs`를 묶어 "정의서→스펙→코드" 2단 드리프트로 승격 보고.
- 증분 run이면 이전 findings와 매칭해 `신규/잔존/해결됨` 병기.

### §3 리포트 산출
`references/report-template.md` 형식으로 `report.md` + `traceability.md`를 `runDir`에 쓴다.
finding 0건이면 "✅ Converged" 클린 리포트. 산출 후 후속 안내(자동 실행 금지):
code-fix → /dt-implement·/dt-be-implement 또는 수동 수정, spec-update → /dt-spec·/dt-be-spec·/dt-devspec 재실행 권고.
- specDiagnosis가 붙은 finding은 §2.5 **스펙 보강 제안(SB)** 으로 변환한다(형식:
  `references/report-template.md` §2.5 — 붙여넣을 수 있는 보강 문구 초안 필수).
- `docs/audits/index.md`에 run 요약 1줄을 append(추이 원장).

### §4 협의 루프 (opt-in — 리포트 후 1회 질문 또는 --consult)
결정 필요 항목(SB 전건 + 🔴 + confirm)을 **하나씩** 협의 카드로 사용자와 재정의한다.
카드 형식·decisions.md 기록·후속 라우팅·역참조 마커는
`references/consult-loop.md`(SOT)를 따른다. 협의는 조율자가 직접 수행하며(워커는 묻지 않음),
`보류` 항목은 `docs/audits/pending.md`로 이월한다. **라우팅 실행(정의서 정정·스펙 백필·코드
수정)은 결정별로 다시 확인 후에만** — 감사의 읽기 전용 원칙은 유지되고, 스펙 쓰기는 라우팅된
후속 스킬(/dt-devspec·/dt-spec·/dt-be-spec)의 자체 승인 절차를 거친다.

### §5 재발 방지 환류 (opt-in)
협의 종료 후 findings를 1회성/재발성으로 분류하고, 재발성만 환류 제안으로 변환해 사용자에게
확인받는다(자동 반영 금지 — 반영은 별도 플러그인 수정 작업):
- 스펙 작성 체크리스트 → `references/contract-elements.md` 항목 추가 제안
- 기계 검출 가능 → dt-frontend-review·dt-backend-review 룰 제안
- 정의서 수준 → dt-devspec 검증 게이트(§2.5) 체크 제안

### §6 후속 연계 (opt-in, 각 1회 제안)
- decisions.md의 `e2e후보` 플래그 항목 → "dt-e2e/dt-be-e2e 시나리오로 만들까요?"
- code-fix 액션 묶음 → "Jira Sub-task로 등록할까요?" (승인 시 dt-worklog-sync — 그 스킬의 dry-run 그대로)

## 실행 모드
- **dispatched (기본)**: 위 구조. `--scope fe`면 fe 워커만.
- **inline degrade (원칙 4)**: 서브에이전트 미지원 시 조율자가 auditor.md의 3단계 절차를 트랙 순차로 직접 수행하고 1줄 고지. 같은 절차·같은 산출.

## 관련
- `references/finding-schema.md` — 판정 어휘·반환 계약 (SOT)
- `references/report-template.md` — 리포트·traceability 형식
- `references/drift-detection.md` — git 드리프트 판정 절차
- `references/contract-elements.md` — 계약 요소 체크리스트 (침묵 수집·상향정합·환류 공유 SOT)
- `references/consult-loop.md` — 협의 카드·결정 기록·라우팅 (SOT)
- `../../docs/orchestration-policy.md` — 병렬/순차/폴백 정책
