---
name: dt-backend-review
description: Use when reviewing dt-backend (NestJS) project code for architecture/test rule violations, when the backend scaffold workflow needs a phase-level mini-review, or when running /dt-be-review. Parses dt-backend-architecture and dt-backend-testing patterns frontmatter and applies detection logic (forbidden-import, forbidden-call, forbidden-pattern, requires-sibling-test, required-pattern, ast-rule) against changed files plus diff-based coverage gate.
---

# dt-backend Review

> **컨텍스트 격리(정책 원칙 3):** 오케스트레이션(scaffold 등) 안에서 호출될 때 본 리뷰는 **항상 전용 서브에이전트에서 실행**되어야 한다 — diff·추론은 격리하고 verdict만 반환한다. 상세 `../../docs/orchestration-policy.md`. (스크립트 `review.mjs` 로직은 불변, 호출 컨텍스트만 격리.)

> **다른 스킬과의 관계**
> - 작성 시점 가이드: `dt-backend-architecture` (Atlas) + `dt-backend-testing` (Atlas)
> - 본 skill은 review automation — patterns/*.md 의 detection 메타데이터를 직접 파싱해 적용
> - **엔진은 FE와 공유**한다: stack-agnostic 리뷰 엔진(`skills/dt-frontend-review/scripts/review.mjs`)을 `--stack backend`로 호출하면 backend 룰 디렉토리(`dt-backend-architecture/patterns`, `dt-backend-testing/patterns`) + `.dt-backend.json` + jest 커버리지로 동작한다.

자동 검사:
1. `git diff <base>...HEAD`로 변경 파일 식별
2. 각 변경 파일에 대해 backend patterns/*.md frontmatter의 detection 메타데이터 적용
3. `jest --coverage`로 HEAD/BASE 측정 + per-file 비교 (`.dt-backend.json`의 `coverage.mode`에 따라)
4. Critical/Important/Minor + Coverage 리포트 출력

## 활성화 조건
- 현재 작업 디렉토리에 `.dt-backend.json`이 있고 `enabledSkills`에 `dt-backend-review` 포함
- 또는 사용자가 명시적으로 `/dt-be-review` 호출

## 슬래시 명령
`/dt-be-review [full|partial] [--base <ref>] [--paths a.ts,b.ts] [--verbose]`

내부적으로 실행:
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/dt-frontend-review/scripts/review.mjs" $ARGUMENTS --stack backend
```

- 기본: `full` 모드, `base`는 `.dt-backend.json`의 `coverage.baselineRef`(기본 HEAD)
- `partial`: scaffold의 phase-level mini-review용. `--paths`로 검사 대상 명시.
- `--verbose`: Manual Review 휴리스틱 스텁(AST 미구현 룰)을 파일별로 출력.

## 룰 frontmatter 필드 / Detection 타입
FE와 동일한 스키마·detector를 사용한다 (`dt-frontend-review` SKILL.md 참조). backend 전용 룰은 다음 detector를 사용:

- `forbidden-import` — `@prisma/client`/`ioredis`/`express` 등 레이어별 금지 import
- `forbidden-pattern` — `res.status(`, `new Queue(`, 중앙 키 팩토리 위반 등
- `requires-sibling-test` — `*.service.ts`↔`*.unit.test.ts`, `*.controller.ts`↔`*.integration.test.ts`
- `required-pattern` — 요청 DTO의 class-validator 데코레이터 강제 (validation-at-boundary)
- `ast-rule` — controller-no-business-logic / module-registration (v1 수동 검토 stub)

## 코딩 규율 Manual Review
`dt-backend-coding-discipline`의 판단 룰(Simplicity / Surgical / Goal-Driven)을 변경 diff에서 육안 확인 — severity minor.

## 의존성
- Node 18+ / 외부 npm 의존성 없음
- coverage 측정: 사용자 프로젝트의 `jest --coverage` 실행 가능해야 함 (`coverageReporters: ['json-summary']`)
