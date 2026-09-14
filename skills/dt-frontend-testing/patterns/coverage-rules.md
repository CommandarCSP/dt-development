---
ruleId: coverage-rules
summary: "비즈니스 코드 80%+ (View 제외), critical 영역(business/store) 85% 권장, 어서션 품질 우선"
severity: critical
appliesTo: ["vitest.config.*"]
detection:
  - type: ast-rule
    description: "vitest.config의 coverage.thresholds가 비즈니스 경로(business/, store/, components/domain/, pages/) 기준 80 미만이거나, business/store가 include에서 빠지면 위반."
relatedRules: [test-case-design-techniques, test-anti-patterns]
---

# Coverage 룰 (리스크 기반 차등 임계값)

## 게이트 (전역 최소)

비즈니스 코드 80% 이상.
- include: `business/`, `store/`, `components/domain/`, `pages/`, `utils/`
- exclude: `components/view/`, `_example/`, `legacy/`, `__tests__/`, `*.test.*`

## 리스크 기반 티어 (가이드라인)

높은 커버리지 ≠ 좋은 테스트. 그러나 비즈니스 임팩트 큰 코드일수록 더 촘촘히 검증해야 회귀를 잡는다.

| 티어 | 경로 | 권장 임계값 | 이유 |
|---|---|---|---|
| **Critical** | `src/business/hooks/**`, `src/store/queries/**` | **85%** lines + **80%** branches | 도메인 로직의 핵심. 변환/캐시/뮤테이션 모두 여기 |
| **Important** | `src/components/domain/**`, `src/pages/**`, `src/store/stores/**` | **80%** lines | 사용자 시나리오 진입점 |
| **Standard** | `src/utils/**`, `src/auth/**` | **75%** lines | 단순 헬퍼/상수가 많아 임계값↓ 가능 |
| **Excluded** | `src/components/view/**`, `src/types/**`, `src/mocks/**`, `_example/**` | — | UI 스타일/모킹/타입 정의 |

### vitest.config.ts 적용 예 (선택)

```ts
coverage: {
  provider: 'v8',
  include: [
    'src/business/**',
    'src/store/**',
    'src/components/domain/**',
    'src/pages/**',
    'src/services/**',
    'src/utils/**',
  ],
  exclude: [
    'src/components/view/**',
    'src/types/**',
    'src/mocks/**',
    'src/_example/**',
    '**/__tests__/**',
    '**/*.test.{ts,tsx}',
  ],
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
    // 차등 임계값 (Vitest의 perFile 패턴 지원 시 활용)
    'src/business/**/*.ts': { lines: 85, branches: 80 },
    'src/store/queries/**/*.ts': { lines: 85, branches: 80 },
  },
},
```

> `perFile` glob 차등은 Vitest 버전에 따라 다름. 미지원 시 전역 80%만 강제 + critical 영역은 코드리뷰에서 수동 가드.

## 어서션 품질도 함께 보자

100% 라인 커버리지여도 어서션이 `expect(result).toBeDefined()` 뿐이면 회귀 잡지 못함.

- 적어도 한 개의 의미있는 도메인 assertion
- mutation: 성공/실패 결과 모두 검증 ([[test-case-design-techniques]]의 결정 테이블)
- 변환 함수: 입력의 모든 분기에 대해 출력 검증

## 우선순위 (커버리지 갭 처리 순서)

| 우선 | 영역 | 이유 |
|---|---|---|
| **P0** | mutation + 캐시 invalidation | 실패 시 데이터 불일치, 디버깅 비용↑↑ |
| **P1** | DTO → Model 변환 함수 | 잘못된 매핑 = 모든 UI 깨짐 |
| **P2** | 분기 많은 hook 로직 (enabled, conditional fetch) | 엣지에서 잠재 버그 |
| **P3** | 단순 표시 컴포넌트 | 시각만 영향, View 룰 excluded라 보통 비대상 |

## 모드

`.dt-frontend.json`의 `coverage.mode`:
- `diff` (기본): 변경 파일만 strict 80%, 그 외 파일은 baseline 유지
- `total`: 전체 80%
- `off`: 검사 안 함

## Diff baseline 계산

(Plan 2의 review가 구현하는 알고리즘)
1. HEAD coverage 측정
2. baselineRef를 임시 worktree에 체크아웃해 coverage 측정 (캐싱)
3. per-file LCOV 비교

## 관련 규칙
- [[test-case-design-techniques]] (어떻게 케이스를 도출해 커버리지를 의미있게 채울지)
- [[test-anti-patterns]] (커버리지만 채우는 의미없는 테스트 회피)
- [[flaky-test-prevention]]
