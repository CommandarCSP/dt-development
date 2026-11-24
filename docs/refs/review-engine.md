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

## 2. 커버리지와 폴더 구조

- `full --base <ref>`일 때 HEAD와 기준 커밋의 커버리지를 재서 바뀐 파일만 비교한다. 재는 명령(`commands.coverage`)과 기준 커밋 설치 명령(`commands.install`)은 `scripts/stackCommands.mjs`가 고른다. 측정이 실패하면 보고서에 쓴 명령과 고른 근거가 나온다.
- 규칙의 표준 경로(`src/...`·`e2e/...`·`test/...`)는 스택 설정 `paths.*`·`layout`으로, 표준 테스트 이름(`__tests__/*.unit.test.ts`)은 `testing.location`·`testing.suffix`로 프로젝트에 맞게 바뀐다(`scripts/review/lib/layout.mjs`).
- BE는 규칙의 ORM 빈칸을 `stack.orm`(없으면 package.json 감지)으로 채우고, `stack.<영역> = none`인 규칙을 건너뛴다(`scripts/stackAdapters.mjs` → `scripts/review/lib/stack-rules.mjs`).
- 키와 고르는 순서는 [스택 설정](stack-config.md)이 원본이다.
