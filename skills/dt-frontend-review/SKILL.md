---
name: dt-frontend-review
description: Use when reviewing dt-frontend project code for architecture/test rule violations, when scaffold workflow needs a phase-level mini-review, or when running /dt-review. Parses dt-frontend-architecture and dt-frontend-testing patterns frontmatter and applies detection logic (forbidden-import, forbidden-call, required-pattern, ast-rule) against changed files plus diff-based coverage gate.
---

# dt-frontend Review

> **컨텍스트 격리(정책 원칙 3):** 오케스트레이션(scaffold 등) 안에서 호출될 때 본 리뷰는 **항상 전용 서브에이전트에서 실행**되어야 한다 — diff·추론은 격리하고 verdict만 반환한다. 상세 `../../docs/orchestration-policy.md`. (스크립트 `review.mjs` 로직은 불변, 호출 컨텍스트만 격리.)

> **다른 스킬과의 관계**
> - 작성 시점 가이드: `dt-frontend-architecture` (Atlas) + `dt-frontend-testing` (Atlas)
> - 본 skill은 review automation — patterns/*.md 의 detection 메타데이터를 직접 파싱해 적용
> - architecture/testing의 Atlas 1줄 요약은 본 skill이 검사하는 룰 전체와 1:1 대응 (Atlas가 인간 진입점, 본 skill이 자동화 출력)

자동 검사:
1. `git diff <base>...HEAD`로 변경 파일 식별
2. 각 변경 파일에 대해 patterns/*.md frontmatter의 detection 메타데이터 적용
3. `vitest --coverage`로 HEAD/BASE 측정 + per-file 비교 (`.dt-frontend.json`의 `coverage.mode`에 따라)
4. Critical/Important/Minor + Coverage 리포트 출력

## 활성화 조건
- 현재 작업 디렉토리에 `.dt-frontend.json`이 있고 `enabledSkills`에 `dt-frontend-review` 포함
- 또는 사용자가 명시적으로 `/dt-review` 호출

## 슬래시 명령
`/dt-review [--mode full|partial] [--base <ref>] [--paths a.ts,b.ts] [--verbose]`

- 기본: `full` 모드, `base`는 `.dt-frontend.json`의 `coverage.baselineRef`(기본 HEAD)
- `partial`: scaffold의 phase-level mini-review용. `--paths`로 검사 대상 명시.
- `--verbose`: Manual Review 휴리스틱 스텁(AST 미구현 룰)을 모든 파일별로 출력. 기본은 룰별 카운트만 요약. 실제 Critical/Important 위반은 항상 노출됨.

## 출력 포맷
```
### Critical (must fix)
- src/components/domain/PostList.tsx:12 — domain-no-direct-api — 위반: forbidden-import (axios)

### Coverage
- src/business/hooks/comments/useCommentListViewModel.ts: 신규 파일 ... 65% (80% 필요)

### Assessment
Ready to merge: No
Reasoning: Critical 위반 1건 + coverage 1건 — 머지 전 수정 필요.
```

## 동작 원리

- `patterns/*.md`의 frontmatter (`ruleId`, `severity`, `appliesTo`, `detection`)를 직접 파싱
- 룰 본문(예시)과 detection 로직이 같은 파일에 있어 드리프트 차단

## 룰 frontmatter 필드

- `appliesTo`: 룰이 적용되는 파일 glob (필수)
- `excludePathPatterns`: 위 appliesTo 매칭에서 제외할 경로 glob (선택, 기본 `[]`). 예: `appliesTo: ["src/**/*.ts"]` + `excludePathPatterns: ["src/services/**"]`로 "services 제외 전체"를 표현.
- `severity`: critical | important | minor
- `detection`: 아래 detection 타입 배열

- Detection 타입:
  - `forbidden-import`: import 경로/모듈 차단 (`excludePatterns`로 예외 지정 가능, 예: `*.scss` 차단 + `*.module.scss` 허용)
  - `forbidden-call`: 특정 함수 호출 차단 (matchArguments로 인자 조건 가능)
  - `forbidden-pattern`: 원시 정규식 패턴 차단. `{ type: 'forbidden-pattern', pattern: 'style=\\{\\{' }` 식. JSX 속성·문자열 등 import/호출이 아닌 텍스트 패턴 검출용.
  - `requires-sibling-test`: 검사 대상 파일에 대응하는 sibling 테스트 파일 존재를 강제. `{ type: 'requires-sibling-test', testPath: '__tests__/{basename}.test.ts' }` 식. `*Business.ts` 같이 단위 테스트 필수 모듈에 적용.
  - `required-pattern`: 휴리스틱 (현재 querykey-param 한정), 미지원 패턴은 manual-review 표시
  - `ast-rule`: v1 stub, manual-review 표시

## 주석 Manual Review

자동 검출 불가 — 변경 파일에서 다음을 육안 확인:

| 체크 | 기준 |
|---|---|
| WHAT 주석 존재? | 함수명·변수명 반복, 단계 설명(`// 반환`, `// 실행`) → 제거 권고 |
| WHY 주석 누락? | 비직관적 값/순서, 외부 버그 우회, 레이어 규칙 예외처럼 보이는 코드에 설명 없음 → 추가 권고 |
| PR/태스크 참조? | `// GNB 이슈 수정` 류 → 커밋 메시지로 이동 권고 |

severity: minor (머지 블로킹 아님, 코드 리뷰 코멘트 수준)

## 코딩 규율 Manual Review

`dt-frontend-coding-discipline`의 판단 룰 — 정규식으로 못 잡으니 변경 diff를 육안 확인:

| 체크 | 기준 |
|---|---|
| Simplicity | 단일 용도 코드에 불필요한 추상화/옵션/설정 → 단순화 권고 |
| Surgical | 요청과 무관한 인접 코드·포맷·스타일 변경, 무관 dead code 삭제 → 되돌림 권고 |
| Goal-Driven | 버그 수정인데 재현 테스트 없음, 검증 가능한 성공 기준 부재 → 테스트 추가 권고 |

severity: minor (머지 블로킹 아님). 자세한 원칙은 `dt-frontend-coding-discipline` skill 참조.

## 의존성
- Node 18+
- 외부 npm 의존성 없음 (built-in `fs`, `child_process`, `node:test`만 사용)
- coverage 측정: 사용자 프로젝트의 `pnpm test --coverage` 명령 실행 가능해야 함
