---
name: dt-fullstack
description: Use when the user wants to build a full web app end-to-end from requirements/UX sources — "웹앱 만들어줘", "풀스택 구축", or /dt-fullstack. 최상위 얇은 조율자로 정의서(dt-devspec) → BE 스펙·구현(dt-bespec/dt-be-implement) → FE 스펙·구현(dt-spec/dt-implement) → 리뷰(dt-review/dt-be-review) 파이프라인을 한 번에 합성한다. 개별 스킬을 대체하지 않고 합성만 하며, 각 단위는 파일로 소통해 단독 실행도 그대로 가능.
---

# dt-fullstack — 전체 파이프라인 통합 (최상위 조율자)

요구사항/UX 소스에서 풀스택 웹앱을 end-to-end로 만든다. **얇은 조율자**다 — 자기 컨텍스트엔 단계 포인터·진행 레지스터만 두고, 무거운 작업은 author/builder 워커가 **격리 컨텍스트**에서 끝낸다(컨텍스트 경제). 개별 스킬(`/dt-devspec`·`/dt-spec`·`/dt-implement` 등)은 **그대로 단독 실행 가능** — 본 스킬은 그것들을 *합성*만 한다(대체 X).

> 실행 모드·병렬/순차·리뷰 격리·인라인 degrade는 공용 정책 `../../docs/orchestration-policy.md`(원칙 1~4)를 따른다. 각 하위 스킬의 dispatched/inline 실행 모드와 파일 기반 이중 동작 계약을 그대로 이용한다.

## 파이프라인 (순서)

```
[1] 정의서   dt-devspec            → docs/specs/definition.md (SOT)              [게이트: 사용자 확정]
[2] BE 스펙  dt-bespec (홀리스틱)   → 전 리소스 스펙 + interactions.md(BE 크로스리소스)  ※BE 먼저 — 계약·런타임 권위
[3] BE 플랜  plan-author (홀리스틱) → 리소스별 plan.md(+크로스리소스 배선)  →[plan 승인]→ dt-be-implement (be-builder, 유닛 격리)
[4] FE 스펙  dt-spec (홀리스틱)     → 전 페이지 스펙 + interactions.md(크로스페이지)  ※BE 계약 소비
[5] FE 플랜  plan-author (홀리스틱) → 페이지별 plan.md(+크로스페이지 배선)  →[plan 승인]→ dt-implement (fe-builder, 유닛 격리)
[6] 리뷰     dt-be-review / dt-review (reviewer 격리, interactions 정합 검증)
```

- **기획=홀리스틱 / 구현=격리 (핵심)**: 스펙·플랜은 유닛별로 쪼개 병렬로 돌리면 **유닛 간 상호작용(페이지 A 수정→B 목록 반영, 크로스리소스 트랜잭션)이 침묵 누락**된다. 그래서 **스펙/플랜은 스택당 한 컨텍스트**(FE 전 페이지를 한 spec-author·한 plan-author, BE 전 리소스를 한 bespec-author·한 plan-author)로 홀리스틱하게 지어 `interactions.md`를 산출·소비하고, **무거운 구현(builder)만 유닛 격리 병렬**로 컨텍스트 경제를 지킨다. 스펙/플랜은 가벼워(opus·판단) 홀리스틱 비용이 낮고, 각 유닛 산출은 파일로 영속화돼 컴팩팅 헷지된다.
- **BE 먼저**: 엔드포인트·응답 형태는 BE 계약면이 권위(D8). FE는 그 계약을 소비하므로 BE 스펙·구현을 앞에 둔다. **FE가 실제로 읽는 BE 계약 채널은 `definition.md`의 IF/DM**(BE 상향정합 T2/T3로 `확정` 승격된 환류분) — spec-author/fe-builder는 BE의 `api-contract.md`를 직접 읽지 않는다. 즉 정의서 IF가 FE↔BE를 묶는 단일 계약면.
- **[plan]**(durable 3겹의 셋째 — `definition → spec → plan`): 구현 직전 **`plan-author`(model: opus)**가 **한 스택의 전 유닛 스펙 + interactions.md를 한 시야로** 읽어 유닛별 코드-레벨 체크박스(`docs/specs/<unit>/plan.md`)에 **크로스유닛 배선(`[X]`)** 까지 박고(강한 모델이 판단 소진), builder(model: sonnet)가 그 체크박스를 유닛 격리로 실행(컴팩팅 헷지). 조율자가 plan-author dispatch(스택당 1회) → 사용자 **plan 승인 게이트** → builder. plan.md 최신이면 재생성 생략.

## 얇은 조율자 규칙
- **포인터만 보유**: 각 단계는 산출물을 파일로 쓰고 조율자엔 `{위치, 상태, needsDecision, 요약}`만 반환(이중 동작 계약). 조율자 컨텍스트는 단계 레지스터로만 부푼다.
- **HITL은 조율자에만**: 단계 진입 게이트(스펙 확정·**plan 승인**)와 워커의 `needsDecision`은 조율자가 `AskUserQuestion`으로 묻고, 답과 함께 워커를 **재dispatch**한다(워커는 `.dt-spec/`·`.dt-impl/`에서 재개). 사용자 채널은 조율자(메인 세션)에만 있음.
- **스펙·플랜은 홀리스틱(병렬 아님)**: 유닛별로 spec-author/plan-author를 병렬 dispatch하지 **않는다** — 스택당 **한 번** dispatch해 전 유닛을 한 컨텍스트에서 짓게 한다(크로스유닛 상호작용 포착). 이게 이전 "페이지별 병렬 스펙"에서 바뀐 핵심.
- **구현(builder)만 유닛 간 병렬**: 서로 다른 리소스/페이지의 builder는 **병렬 dispatch**(다른 경로라 충돌 없음 — 원칙 1). 유닛 내부는 순차. 각 builder는 자기 plan(크로스유닛 `[X]` 배선 포함) + interactions.md를 소비. **단 BE 예외**: 모든 리소스가 `prisma/schema.prisma`를 공유하므로 **스키마 머지(Phase 1~2) 구간은 순차화**하고, FK/조인으로 다른 리소스를 참조하는 리소스(예: feed→posts·users)는 **의존 리소스 뒤로** 둔다(순서 근거는 plan/interactions.md의 크로스리소스 노트). FE는 경로 분리라 페이지 간 완전 병렬.
- **수정 루프**: reviewer가 `NEEDS_REPAIR`면 일회성 builder는 죽었으므로 **verdict(repairTargets) + `.dt-impl/<unit>` 상태로 같은 builder를 재dispatch**해 그 부분만 수정(메인 직접수정 X). **1회 repair 후 실패면 사용자 보고·중단**(자동 무한루프 금지).
- **인라인 degrade**(원칙 4): 서브에이전트 미지원이면 각 단계를 조율자가 직접 수행(개별 스킬의 inline 모드) — 같은 절차·같은 산출.

## 게이트 (단계 경계 = HITL 체크포인트)
1. 정의서 확정(`/dt-devspec` 산출 검토) → 진행 승인.
2. 스펙 확정 — 유닛 스펙 + **`interactions.md`(크로스유닛 상호작용·액션→리액션)** 검토. draft면 needsDecision 해소 후 finalized → 구현 진입 전 승인. (홀리스틱 author가 스택당 한 번에 산출하므로 게이트도 스택당 1회.)
3. plan 승인(`plan-author`가 생성한 유닛별 `plan.md` + 크로스유닛 `[X]` 배선 검토) → builder 실행.
4. 리뷰 verdict(코드 규칙 + `interaction-integrity` 정합) → repair 또는 완료.
- **미해소 부분은 구현에 추측으로 내리지 않는다**(싼 모델이 빈칸을 추측 — 모델 티어링 §7). 단 하위 `dt-spec`/`dt-bespec` §0은 **소프트 게이트**다: `status:draft`면 전면 차단이 아니라 **미해소 IF만 `<!-- skipped -->` 마커로 빼고 나머지는 진행**한다. 따라서 조율자는 *그 미해소 부분만* needsDecision으로 막고, 해소된 부분은 구현을 진행시킨다.

## 부분 실행 모드 (전체 강제 아님)
사용자 의도에 따라 투입 단계만 선택한다:
- **"API만/백엔드만"** → [1]?·[2]·[4] (정의서는 있으면 소비).
- **"FE만/화면만"** → [3]·[4] (BE 계약은 `definition.md` IF/DM 소비; 정의서 없으면 standalone 경고).
- **"이 기능만 추가"** → 해당 리소스/페이지 단위만 [2]/[3] + [4].
- 전체 신규 → [1]~[4] 순차.

## 호출하는 단위 (이름만 — 로직은 각 스킬/에이전트가 소유)
| 단계 | 스킬(조율 진입) | 워커(격리 실행) | dispatch 단위 |
|---|---|---|---|
| 정의서 | `dt-devspec` | `definition-author` | 1회 |
| BE 스펙 | `dt-bespec` (dt-bespec-generate-spec) | `bespec-author` | **스택당 1회(전 리소스 홀리스틱)** |
| [plan] (구현 직전) | (dt-implement/dt-be-implement phase) | `plan-author` (opus) | **스택당 1회(전 유닛 홀리스틱)** |
| BE 구현 | `dt-be-implement`/`dt-backend-scaffold` | `be-builder` + `reviewer` | 리소스별(병렬) |
| FE 스펙 | `dt-spec` (dt-spec-generate-spec) | `spec-author` | **스택당 1회(전 페이지 홀리스틱)** |
| FE 구현 | `dt-implement`/`dt-frontend-scaffold` | `fe-builder` + `reviewer` | 페이지별(병렬) |
| 리뷰 | `dt-review`/`dt-be-review` | `reviewer` | 유닛별 |

> **모델 티어링(§7)**: 기획·판단·리뷰 = **opus**(definition/spec/bespec/plan-author·reviewer), 코드 구현 = **sonnet**(fe/be-builder). 각 에이전트 frontmatter `model:`에 고정 — 메인 세션 모델과 무관하게 단계별 모델 보장.

## 활성화 조건
"웹앱/풀스택 만들어줘" 류 전체 구축 요청, 또는 `/dt-fullstack [부분모드]` 명시 호출. 단위 작업만 원하면 개별 스킬을 직접 쓰면 된다(본 스킬은 합성 전용).

## 안 하는 것
- 개별 스킬 대체(합성만) · 메인이 직접 분석/구현(워커가 격리 수행) · draft 스펙을 구현에 투입 · Epic/스토리 관리(작업 추적은 dt-worklog-sync).
