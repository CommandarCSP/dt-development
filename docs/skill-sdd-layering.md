# 스킬(전역 컨벤션) ↔ SDD(프로젝트별 기술) 레이어 계약 (SSOT)

dt-development 스킬이 만들어내는 코드의 "기술 결정"이 어느 레이어에서 오고 어떻게 우선되는지의 단일 출처.

## 두 레이어
- **하위 — 전역 스킬 컨벤션**: dt-frontend/backend-architecture 등 스킬이 강제하는 **프로젝트 무관 기준**(5-layer, fetcher-separation, server/client 분리, 스타일 baseline=Tailwind/shadcn 등). 거의 불변, 모든 프로젝트에 일률 적용.
- **상위 — SDD 스펙(프로젝트별)**: `docs/specs/pages|resources/<x>/` + `docs/project-context.md`. 프로젝트마다 다른 요구·기술 가산·예외.

## 우선순위
`사용자 직접 지시 > project-context 선언(추가/오버라이드) > 전역 스킬 룰 > 벤더 기본`

## 원칙
1. **상위 레이어는 선택적(Optional)** — SDD 스펙/project-context가 **없어도** 전역 스킬은 단독으로 완결 동작한다(예: `/dt-scaffold` standalone, 룰만 보고 직접 작성). 어떤 룰/스킬도 상위 존재를 **hard-depend 하지 않는다**.
2. **가산(Additive)** — 전역 세트 외 추가 라이브러리는 충돌이 아니므로 그대로 우선 적용. 정본 자리 = `project-context.md`의 `## 프로젝트 기술/라이브러리` 섹션(권위 지시).
3. **예외 오버라이드(전역 choice 룰 거스름)** — 자동 금지. **사용자 대화 게이트 → 합의 → project-context overrides 기록 → review/scaffold가 honor.** (메커니즘은 웨이브 B에서 구현.)
   - **구현(웨이브 B 완료)**: `.dt-frontend.json`의 `overrides`(의미 키)로 선언 → review가 태그된 룰을 skip + 보고에 1줄 표기. 예: `"overrides": { "styling": "mui" }`. **오버라이드 가능 키: `styling`**(→ view-styling·no-hardcoded-design-values skip). 구조 룰은 불가. 절차: 사용자 대화 게이트 → `.dt-frontend.json` 기록 + project-context 근거.
4. **경계** — 오버라이드 대상 = "선택" 컨벤션(styling/컴포넌트/폼 lib)만. **구조 컨벤션(5-layer·fetcher-separation·server/client 분리·import 방향)은 불변(오버라이드 불가).**
5. **충돌/폴백** — 선언 없으면 전역 기본, 있으면 우선, 모호하면 질문.

## 사용 모드 (상위 레이어 존재량 스펙트럼)
| 모드 | 상위 | 동작 |
|---|---|---|
| 스킬 단독 | 없음 | 전역 컨벤션만으로 완결 |
| 상위 + 가산 | 있음 | 전역 + project-context 추가 lib |
| 상위 + 예외 오버라이드 | 있음 | 전역 choice 룰을 대화 합의로 교체(웨이브 B) |
