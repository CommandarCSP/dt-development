---
name: dt-fullstack
description: Use when the user wants to build a full web app end-to-end from requirements/UX sources — "웹앱 만들어줘", "풀스택 구축", or /dt-fullstack. 최상위 얇은 조율자로 이름 있는 단계(definition → be-spec → be-build → fe-spec → fe-build, 선택 e2e·audit·guide·handbook·wrap)를 한 흐름으로 합성한다. 개별 스킬을 대체하지 않고 합성만 하며, 각 단위는 파일로 소통해 단독 실행도 그대로 가능. --from·--only로 부분 실행, 진행 기록으로 재개.
---

# dt-fullstack — 전체 파이프라인 통합 (최상위 조율자)

요구사항/UX 소스에서 풀스택 웹앱을 처음부터 끝까지 만든다. **얇은 조율자**다 — 자기 컨텍스트엔 단계 포인터와 진행 기록만 두고, 무거운 일은 각 단계 스킬과 그 워커가 격리 컨텍스트에서 끝낸다. 개별 스킬(`/dt-devspec`·`/dt-spec`·`/dt-implement` …)은 **그대로 단독 실행 가능**하다. 이 스킬은 그것들을 *합성*만 한다.

> 공용 정책 `${CLAUDE_PLUGIN_ROOT}/docs/orchestration-policy.md`를 따른다: 실행 방식(원칙 1·`team.execution`), 리뷰 격리·수리 루프(원칙 3), 봉투·질문(원칙 5~7), 팀 설정(원칙 8), 결정 기록(원칙 9), 막혔을 때 선택지(원칙 10). 산출물을 누가 쓰고 읽는지는 `${CLAUDE_PLUGIN_ROOT}/docs/refs/artifact-contract.md`.

## 단계 (이름으로 부른다)

| 단계 | 기본 | 부르는 스킬 | 하는 일 · 산출 | 진입 게이트 |
|---|---|---|---|---|
| `definition` | 켬 | `dt-devspec` | 정의서 `docs/specs/definition.md`(FE·BE 분담, IF 계약) | — |
| `be-spec` | 켬 | `dt-bespec-generate-spec` | 전 리소스 스펙 + `interactions.md` `## BE 크로스리소스` | 정의서 확정 |
| `be-build` | 켬 | `dt-be-implement` | 스택 사전 점검 → 플랜(plan-author) → **plan 승인** → 구현(be-builder) → 격리 리뷰·수리 | BE 스펙 확정 |
| `fe-spec` | 켬 | `dt-spec-generate-spec` | 전 페이지 스펙 + `interactions.md` `## FE 크로스페이지` | BE 계약(정의서 IF) 확정 |
| `fe-build` | 켬 | `dt-implement` | 스택 사전 점검 → 플랜 → **plan 승인** → 구현(fe-builder) → 조립(assemble) → 격리 리뷰·수리 | FE 스펙 확정 |
| `e2e` | 선택(권장 켬) | `dt-be-e2e` → `dt-e2e` | 수용 시나리오 원장·테스트(e2e-author). 승인·`verified`는 사람 | 구현 완료 |
| `audit` | 선택 | `dt-audit` | 스펙 대비 구현 감사 리포트 `docs/audits/` | 구현 완료 |
| `guide` | 선택 | `dt-guide` | 사용자 가이드 PDF | 구현 완료 |
| `handbook` | 선택 | `dt-handbook` | 개발자 핸드북 PDF | 구현 완료 |
| `wrap` | 선택(권장 켬) | `dt-wrap` | 커밋 → 문서화 판단 → Jira 동기화(각 단계 확인) | 마지막 |

- **BE 먼저**: 엔드포인트·응답 형태는 BE 계약이 권위다. FE는 그 계약을 `definition.md`의 IF/DM으로 소비한다(BE 상향 정합 T2/T3로 `확정` 승격된 것). spec-author·fe-builder는 BE의 `api-contract.md`를 직접 읽지 않는다.
- **기획=홀리스틱 / 구현=격리**: 스펙·플랜은 스택당 한 워커가 전 유닛을 한 시야로 짓는다(유닛 간 상호작용 포착). 무거운 구현(builder)만 유닛별 격리·병렬이다. 단 BE는 `prisma/schema.prisma`를 공유하므로 스키마 머지 구간은 순차로, FK로 다른 리소스를 참조하는 리소스는 뒤로 둔다(근거는 plan·interactions의 크로스리소스 노트).
- **플랜·리뷰는 build 단계 안에 있다.** 플랜 작성(plan-author, 산출 `docs/specs/<pages|resources>/<unit>/plan.md`)·plan 승인 게이트·격리 리뷰와 수리 루프는 각 implement 스킬이 맡는다. fullstack은 플랜을 따로 만들지 않고, 리뷰를 따로 다시 돌리지 않는다. 리뷰 결과는 implement 봉투에서 모아 보고한다.

## 시작할 때

1. **팀 설정·결정을 읽는다** — `scripts/lib/config.mjs`(경고 보고, `team.execution`·`team.models`), `scripts/decisions.mjs list`(채택된 PD·TP → 각 단계에 `decisions`로 전달).
2. **진행 기록을 본다** — `.dt-fullstack/progress.json`이 있으면 "이어서 할까요(마지막 완료: `<단계>`) / 처음부터 / 중단"을 묻는다.
3. **할 단계를 한 번에 정한다** — 인자(`--from`·`--only`)가 없으면 AskUserQuestion `multiSelect`로 선택 단계를 고르게 한다. 선택지: `e2e`(권장) · `wrap`(권장) · `audit` · `guide` · `handbook`. 기본 단계(definition~fe-build)에 이미 산출물이 있으면 "다시 만들기 / 있는 것 쓰기"를 단계별로 묻는다.
4. 정한 단계 목록과 순서를 한 줄로 보이고 시작한다.

## 진행 기록 (`.dt-fullstack/progress.json`, 스크래치 — git 무시)

```json
{ "startedAt": "…", "stages": [
  { "name": "be-build", "status": "pending|running|done|skipped|blocked", "artifacts": ["…"], "summary": "…", "updatedAt": "…" } ] }
```

- 단계를 시작할 때 `running`, 봉투를 받으면 봉투의 `status`에 맞춰 `done`·`blocked`로 바꾼다. 사용자가 건너뛰면 `skipped`.
- 끊겨도 이 파일과 각 단계 산출물(파일)로 이어간다. 단계 안의 재개는 그 스킬의 스크래치(`.dt-spec/`·`.dt-impl/`…)가 맡는다.

## 얇은 조율자 규칙
- **포인터만 보유**: 단계는 산출물을 파일로 쓰고, 조율자는 봉투(`{ status, artifacts, needsDecision, summary, … }` — 원칙 5)만 받는다.
- **사람 확인은 조율자에만**: 단계 진입 게이트·plan 승인·워커의 needsDecision·가정 목록은 조율자가 묻는다(원칙 6·7). 단계 사이에서 **확인 없이 다음 단계로 넘어가지 않는다.**
- **`status: blocked`면** 다음 단계로 넘기지 않고 원칙 10의 선택지를 보인다(예: 정의서가 깨짐 → "`dt-devspec` 재생성 이어서 실행 / 중단").
- **미해소 부분은 구현에 추측으로 내리지 않는다.** 하위 스펙 스킬의 §0은 소프트 게이트다 — draft면 미해소 IF만 `<!-- skipped -->`로 빼고 나머지로 계속한다. 조율자는 그 미해소 부분만 막는다.
- **스택 사전 점검**: `be-build`·`fe-build`의 implement 스킬이 `${CLAUDE_PLUGIN_ROOT}/docs/refs/stack-precheck.md`를 돈다. 그 질문은 단계 진입 게이트와 함께 묶어 묻는다.
- **모델**: 기본은 각 에이전트 머리말의 `model`(판단·기획·판정 = opus, 구현 = sonnet). 팀 설정 `team.models`가 있으면 그 값으로 덮어 dispatch한다(원칙 8).
- **인라인 degrade**(원칙 4): 서브에이전트가 없으면 각 단계 스킬의 inline 모드로 — 같은 절차·같은 산출.

## 부분 실행
- `--from <단계>`: 그 단계부터 끝까지(선택 단계는 3번 질문대로).
- `--only <단계,…>`: 적은 단계만. 앞 단계 산출물이 없으면 원칙 10대로 "앞 단계를 이어서 실행 / 중단"을 묻는다.
- 말로 요청하면 단계 이름으로 바꿔 읽는다:
  - "API만·백엔드만" → `definition`(있으면 소비) · `be-spec` · `be-build`
  - "FE만·화면만" → `fe-spec` · `fe-build`(BE 계약은 정의서 IF; 정의서가 없으면 standalone 경고)
  - "이 기능만 추가" → 그 리소스·페이지 단위로 `be-spec`/`fe-spec` + `be-build`/`fe-build`
  - "테스트·문서까지" → 선택 단계 `e2e`·`guide`·`handbook`

## 끝낼 때
단계마다 봉투 `summary`를 한 줄씩 모아 보인다: 리뷰 판정(implement 봉투의 reviewer verdict), 가정 N건, 한글 lint, 남은 미해소·`skipped` IF, 건너뛴 단계. `wrap`을 골랐으면 마지막에 그 스킬로 넘긴다.

## 활성화 조건
"웹앱/풀스택 만들어줘" 류 전체 구축 요청, 또는 `/dt-fullstack`. 단위 작업만 원하면 개별 스킬을 직접 쓰면 된다(이 스킬은 합성 전용).

## 안 하는 것
- 개별 스킬 대체(합성만) · 메인이 직접 분석·구현(워커가 격리해서 한다) · draft 스펙을 구현에 투입 · 플랜을 따로 만들거나 리뷰를 따로 다시 돌리기(build 단계 몫) · 단계 확인 없이 연쇄 실행 · Epic/스토리 관리(작업 추적은 dt-worklog-sync).
