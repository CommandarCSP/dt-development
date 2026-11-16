# 리뷰 엔진

FE·BE 리뷰가 함께 쓰는 엔진 하나다. 스킬(`dt-frontend-review`·`dt-backend-review`)·`reviewer` 에이전트·스캐폴드 게이트가 모두 이것을 부른다.

## 1. 경로와 호출

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/review/review.mjs" full    [--base <ref>] [--no-coverage] [--project <path>] [--stack frontend|backend] [--verbose]
node "${CLAUDE_PLUGIN_ROOT}/scripts/review/review.mjs" partial --paths a.ts,b.ts [--project <path>] [--stack frontend|backend] [--verbose]
```

- `--stack`이 고르는 것: 규칙 폴더(`dt-<stack>-architecture/patterns`·`dt-<stack>-testing/patterns`), 스택 설정 파일(`.dt-frontend.json`·`.dt-backend.json`), 커버리지 기본 조합(아래 §2). 없으면 `frontend`.
- 종료 코드: 0 머지 가능(또는 판단 불가) · 1 `Ready to merge: No` · 2 엔진 오류.
- 옛 경로 `skills/dt-frontend-review/scripts/review.mjs`는 경고를 내고 새 경로를 부른다. 0.17.0에서 지운다([호환 정책](compat-policy.md) §4).

## 2. 커버리지 명령 고르기

`full --base <ref>`일 때 HEAD와 기준 커밋의 커버리지를 재서 바뀐 파일만 비교한다. 재는 명령은 아래 순서로 처음 정해지는 것을 쓴다.

| 순서 | 어디서 | 패키지 관리자 | 테스트 도구 |
|---|---|---|---|
| 1 | 스택 설정 `coverage.command`·`coverage.installCommand` | 명령을 그대로 쓴다(문자열은 셸, 배열은 `[명령, ...인자]`) | |
| 2 | 스택 설정 `coverage.packageManager`·`coverage.runner` | `pnpm` · `npm` · `yarn` | `vitest` · `jest` |
| 3 | 프로젝트 `package.json` | `packageManager` 필드 | 의존성에 하나만 있으면 그것, 둘 다 있으면 `scripts.test` |
| 4 | lockfile | `pnpm-lock.yaml` · `yarn.lock` · `package-lock.json` | |
| 5 | 스택 기본값 | FE `pnpm` · BE `npm` | FE `vitest` · BE `jest` |

고른 조합이 만드는 명령:

| 도구 | 테스트 | 기준 커밋 설치 |
|---|---|---|
| vitest | `<실행> vitest run --coverage --coverage.reporter=json-summary` | pnpm `install --prefer-frozen-lockfile` · npm `ci` · yarn `install --frozen-lockfile` |
| jest | `<실행> jest --coverage --coverageReporters=json-summary` | 같음 |

`<실행>`은 pnpm `pnpm exec`, npm `npx`, yarn `yarn`이다. pnpm + vitest에 `test` 스크립트가 있으면 지금까지처럼 `pnpm test --run --coverage --coverage.reporter=json-summary`를 쓴다.

두 도구 모두 `coverage/coverage-summary.json`을 내야 한다. 측정이 실패하면 보고서에 쓴 명령과 고른 근거가 나온다. 맞지 않으면 2번이나 1번 키로 고친다.

## 3. 스택 설정의 coverage 키

```json
"coverage": {
  "mode": "full",
  "baselineRef": "HEAD",
  "newCodeThreshold": 80,
  "baselineProtection": true,
  "runner": "jest",
  "packageManager": "npm",
  "command": "npm run test:cov -- --coverageReporters=json-summary",
  "installCommand": ["npm", "ci"]
}
```

`mode`(`full`|`off`)·`baselineRef` 말고는 모두 고르는 값이다. 적지 않으면 §2 순서로 고른다.
