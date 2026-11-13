# 스택 사전 점검 — 절차 SOT

구현·스캐폴드·e2e를 **시작하기 전에 한 번**, 프로젝트가 플러그인 기본 기술과 어디가 다른지 본다. 다르면 묻고, 답을 결정으로 남기고, 빌더에 넘긴다. 이 문서를 7개 스킬이 가리킨다. 절차를 각자 베끼지 않는다.

플러그인의 아키텍처·테스트 규칙과 템플릿은 다음 기본 기술을 전제한다.

- **FE**: React · TanStack Query · Zustand · Tailwind · react-router · Vitest · MSW · Playwright
- **BE**: NestJS · Prisma · Jest · Supertest · Testcontainers

프로젝트가 다른 기술을 쓰는데 확인 없이 만들면, 빌더가 프로젝트 방식과 섞인 코드를 만들거나 게이트가 엉뚱한 도구를 돌린다. 오류가 나지 않아 아무도 모른다.

## 언제 부르나

다음 스킬이 코드를 만들거나 테스트를 돌리기 직전이다. 스택 설정 부트스트랩(`stack-config-bootstrap.md`) 뒤, 빌더 dispatch 전이다.

`dt-implement` · `dt-be-implement` · `dt-frontend-scaffold` · `dt-backend-scaffold` · `dt-e2e` · `dt-be-e2e` · `dt-fullstack`(구현 단계마다)

## 절차

### 1. 점검한다

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/stackPrecheck.mjs" <projectRoot> --stack frontend|backend --json
```

영역마다 `{ key, label, expected, found, status, decidedBy }`가 나온다. `status`는 네 가지다.

| status | 뜻 | 하는 일 |
|---|---|---|
| `same` | 기본과 같다 | 아무것도 안 한다 |
| `absent` | 기본도 대안도 없다 | 묻지 않는다. 플러그인이 기본을 새로 깐다고 한 줄로 알린다(예: "MSW가 없어 새로 설치합니다") |
| `adaptable` | 다른 기술을 쓴다. 프로젝트 방식을 따를 수 있다 | 묻는다 |
| `blocking` | 다른 기술을 쓰는데, 플러그인 템플릿·리뷰 규칙이 기본을 전제한다(예: Prisma 대신 TypeORM, React가 아님) | 묻는다. 결과를 보장할 수 없다고 밝힌다 |

`decidedBy`가 있는 영역은 이미 채택된 결정(PD의 머리말 `topic`이 영역 key와 같음)이 있는 것이다. **묻지 않고** 그 결정을 따른다.

### 2. 묻는다

`questions` 배열의 영역만 묻는다. AskUserQuestion 한 번에 최대 4개씩 묶는다(`docs/orchestration-policy.md` 원칙 6). 서브에이전트 안이면 needsDecision으로 올린다.

**adaptable**

```
header: "<label>"
question: "이 프로젝트는 <label>에 <found>를 씁니다(플러그인 기본: <expected>). 어느 쪽으로 만들까요?
           고른 답은 프로젝트 결정(PD)으로 남겨 다음부터 다시 묻지 않습니다."
options:
  - "프로젝트 방식(<found>) 따르기 (권장)" — 기존 코드와 같은 방식으로 만든다. 플러그인 규칙 중 <expected>를 전제한 부분은 빌더가 맞춰 쓴다
  - "플러그인 기본(<expected>)으로 새로 도입" — 이 기능부터 <expected>를 쓴다. 기존 코드와 두 방식이 섞인다
  - "중단"
```

**blocking**

```
question: "이 프로젝트는 <label>에 <found>를 씁니다. 플러그인의 템플릿·리뷰 규칙은 <expected>를 전제해서 결과를 보장할 수 없습니다."
options:
  - "규칙 없이 진행" — 빌더가 프로젝트 방식으로 만들되, <expected> 전제 규칙과 게이트 일부는 맞지 않을 수 있다. 결과 보고에 "규칙 미적용 영역"을 적는다
  - "중단" — 이 영역을 지원하는 플러그인 확장(로드맵 M1)이 나올 때까지 기다린다
```

### 3. 남긴다

답은 프로젝트 전체에 계속 걸리는 결정이다. `dt-decision` 스킬 new 절차로 PD 초안을 제안한다(원칙 9). 머리말 `topic`에 영역 key(예: `stack.fe.serverState`)를 적는다. 그래야 다음 점검에서 `decidedBy`로 잡혀 다시 묻지 않는다. 사용자가 PD를 거절하면 이번 실행에만 쓰고 다음에 다시 묻는다.

### 4. 넘긴다

빌더 dispatch 때 `decisions`(원칙 9)에 스택 결정을 담는다. fe-builder·be-builder는 그 결정을 checklist의 예시보다 우선한다.

## 이 절차가 하지 않는 것

- 다른 기술용 규칙·템플릿 만들기(예: SWR용 쿼리 훅 규칙). 로드맵 M1(GEN-04~08)에서 한다.
- 이미 있는 코드를 기본 기술로 바꾸기. 사용자가 "플러그인 기본으로 새로 도입"을 골라도, 새로 만드는 코드에만 적용한다.
