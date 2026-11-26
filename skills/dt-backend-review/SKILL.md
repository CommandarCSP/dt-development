---
name: dt-backend-review
description: Use when reviewing dt-backend (NestJS) project code for architecture/test rule violations, when the backend scaffold workflow needs a phase-level mini-review, or when running /dt-be-review. Parses dt-backend-architecture and dt-backend-testing patterns frontmatter and applies detection logic (forbidden-import, forbidden-call, forbidden-pattern, requires-sibling-test, required-pattern, pattern-pair, registered-in-sibling-module, ast-rule, manual) against changed files plus diff-based coverage gate.
---

# dt-backend Review

> **컨텍스트 격리(정책 원칙 3):** 오케스트레이션(scaffold 등) 안에서 호출될 때 본 리뷰는 **항상 전용 서브에이전트에서 실행**되어야 한다 — diff·추론은 격리하고 verdict만 반환한다. 상세 `../../docs/orchestration-policy.md`. (스크립트 `review.mjs` 로직은 불변, 호출 컨텍스트만 격리.)

> **다른 스킬과의 관계**
> - 작성 시점 가이드: `dt-backend-architecture` (Atlas) + `dt-backend-testing` (Atlas)
> - 본 skill은 review automation — patterns/*.md 의 detection 메타데이터를 직접 파싱해 적용
> - **엔진은 FE와 공유**한다: stack-agnostic 리뷰 엔진(`scripts/review/review.mjs`)을 `--stack backend`로 호출하면 backend 룰 디렉토리(`dt-backend-architecture/patterns`, `dt-backend-testing/patterns`) + `.dt-backend.json` + 커버리지(기본 npm + jest)로 동작한다. 엔진 경로는 `${CLAUDE_PLUGIN_ROOT}/docs/refs/review-engine.md`, 폴더 구조·명령 고르기는 `docs/refs/stack-config.md`가 원본이다.

자동 검사:
1. `git diff <base>...HEAD`로 변경 파일 식별
2. 각 변경 파일에 대해 backend patterns/*.md frontmatter의 detection 메타데이터 적용
3. 테스트 도구(기본 jest)의 커버리지로 HEAD/BASE 측정 + per-file 비교 (`.dt-backend.json`의 `coverage.mode`에 따라). vitest를 쓰면 엔진이 알아서 고르고, 못 고르면 `testRunner`(`docs/refs/stack-config.md`)
4. Critical/Important/Minor + Coverage 리포트 출력

## 활성화 조건
- 현재 작업 디렉토리의 `.dt-backend.json`의 `enabledSkills`에 `dt-backend-review` 포함. **파일이 없으면 `${CLAUDE_PLUGIN_ROOT}/docs/refs/stack-config-bootstrap.md` 절차로 만들고 계속한다**
- 또는 사용자가 명시적으로 `/dt-be-review` 호출

## 슬래시 명령
`/dt-be-review [full|partial] [--base <ref>] [--paths a.ts,b.ts] [--verbose]`

내부적으로 실행:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/review/review.mjs" $ARGUMENTS --stack backend
```

- 기본: `full` 모드, `base`는 `.dt-backend.json`의 `coverage.baselineRef`(기본 HEAD)
- `partial`: scaffold의 phase-level mini-review용. `--paths`로 검사 대상 명시.
- `--verbose`: Manual Review(사람 확인 — 기계 검사로 단정하지 못한 항목)를 파일별로 출력.

### 단독 실행 절차 (`/dt-be-review`)
사용자가 직접 부른 리뷰는 **보고서 전문을 보려는 것**이다. 그래서 메인 세션에서 스크립트를 돌려 출력을 그대로 보인다(`docs/orchestration-policy.md` 원칙 3의 단독 실행 예외). 해석·수리 판단은 하지 않는다. 아래 1~5단계를 건너뛰지 않는다 — 명령 파일이 스크립트만 부르고 이 순서를 건너뛰면 설정 없이 조용히 기본값으로 리뷰하게 된다(GEN-33에서 고친 결함).

1. **스택 설정** — 프로젝트 루트에 `.dt-backend.json`이 없으면 `${CLAUDE_PLUGIN_ROOT}/docs/refs/stack-config-bootstrap.md` 절차로 만든다(스택을 못 가리면 묻는다). 만들었으면 한 줄로 알린다.
2. **팀 설정** — `node "${CLAUDE_PLUGIN_ROOT}/scripts/lib/config.mjs" .`의 `warnings`가 있으면 한 줄씩 보인다.
3. **실행**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/review/review.mjs" <명령 인자> --stack backend
   ```
   - 모드가 없으면 `full`. `--base`가 없으면 **프로젝트 전체**(git이 아는 파일 + 아직 추가 안 한 새 파일, `.gitignore` 제외 — git을 못 쓰면 폴더를 훑는다). `--base <ref>`를 주면 그 뒤로 바뀐 파일만. 보고서 Assessment에 검사한 소스 파일 수가 나오고, 0개면 `Ready to merge: Unknown`이다(위반 없음이 아니다). Manual Review 휴리스틱은 룰별 개수로 요약되고, `--verbose`면 파일별로 펼친다.
4. **보고서를 그대로 보인다.** 요약하거나 고치지 않는다. 종료 코드 1이면 Critical이 있다(Ready to merge: No).
5. **후속 안내** — 보고서 뒤에 해당하는 것만 한 줄씩 덧붙인다. 자동으로 고치지 않는다.
   - `override-decision-ref`가 있으면: "`/dt-decision override <키>`로 규칙 끄기에 근거 결정을 단다(또는 override를 지운다)."
   - 1번에서 설정을 새로 만들었으면: "`.dt-backend.json`의 `paths.src`가 맞는지 확인한다."

## override 근거 검사
- full 모드: 스택 설정의 `overrides.<키>`마다 근거 결정(`decisionRef: "PD-NNN"`)을 확인한다. 근거 없음·못 찾음·대체됨은 Critical `override-decision-ref`, 만료는 Important. partial 모드(빌더 게이트)는 검사하지 않는다. 고치는 법: `/dt-decision override <키>`(`${CLAUDE_PLUGIN_ROOT}/docs/orchestration-policy.md` 원칙 9)

## 룰 frontmatter 필드 / Detection 타입
Detection 타입 목록과 뜻은 `${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-review/SKILL.md` "룰 frontmatter 필드"가 단일 출처다(엔진 공유). BE가 주로 쓰는 것: `pattern-pair`(테스트 구조 — supertest·repository mock·컨테이너 수명), `registered-in-sibling-module`(DI 등록), `manual`(판단 규칙).

FE와 동일한 스키마·detector를 사용한다 (`dt-frontend-review` SKILL.md 참조). backend 전용 룰은 다음 detector를 사용:

- `forbidden-import` — `@prisma/client`/`ioredis`/`express` 등 레이어별 금지 import
- `forbidden-pattern` — `res.status(`, `new Queue(`, 중앙 키 팩토리 위반 등
- `requires-sibling-test` — `*.service.ts`↔`*.unit.test.ts`, `*.controller.ts`↔`*.integration.test.ts` (`testing.*` 설정이 있으면 그 이름. `docs/refs/stack-config.md` §3)
- `required-pattern` — 요청 DTO의 class-validator 데코레이터 강제 (validation-at-boundary)
- `pattern-pair` — 파일 안에 A가 있으면 B도 있어야 한다(예: jest 커버리지 설정에 `coverageThreshold`·80 이상)
- `registered-in-sibling-module` — provider·controller가 같은 폴더 `*.module.ts`에 등록됐는지(module-registration)
- `manual` — 기계로 단정하지 못하는 부분. 리뷰어 에이전트가 규칙 문서를 읽고 본다(예: 컨트롤러의 `if` 분기가 업무 규칙인지). 컨트롤러의 반복·누적 계산(`for`·`while`·`.reduce(`·`switch`)은 `forbidden-pattern`이 잡는다

## 코딩 규율 Manual Review
`dt-backend-coding-discipline`의 판단 룰(Simplicity / Surgical / Goal-Driven)을 변경 diff에서 육안 확인 — severity minor.

## 의존성
- Node 18+ / 외부 npm 의존성 없음
- coverage 측정: 엔진이 고른 명령(`docs/refs/stack-config.md` §2)이 사용자 프로젝트에서 돌고 `coverage/coverage-summary.json`을 내야 함
