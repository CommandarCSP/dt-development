---
name: dt-bespec-collect-project-context
user-invocable: false
description: Use within dt-bespec to collect/maintain backend project context (framework, ORM, database, cache/queue, auth strategy, API conventions) into docs/project-context.md. Auto-syncs tech stack from package.json and prisma/schema.prisma. Single-run per session.
---

# dt-bespec Collect Project Context

백엔드 프로젝트의 가변 재료(스택·규약)를 수집해 `docs/project-context.md`로 유지한다. (세션당 1회)

## 입력
- 기존 `docs/project-context.md` (있으면)
- `package.json` (의존성으로 스택 추론, mtime으로 변경 감지)
- `prisma/schema.prisma` (provider/datasource)
- `.env.example` / `nest-cli.json` (선택)
- 사용자 askQuestion (개요/제약/도메인 용어/규약)

## 자동 동기화 (강제 갱신)
- **Framework**: `@nestjs/core` → NestJS (버전)
- **ORM·DB·캐시·큐·인증**: `node "${CLAUDE_PLUGIN_ROOT}/scripts/stackAdapters.mjs" --project . --json`의 `orm`·`db`·`cache`·`queue`·`auth`와 `from`을 그대로 적는다. 감지표(Prisma·TypeORM·Drizzle, `schema.prisma` provider·`pg`·`mysql2`·`better-sqlite3`, `bullmq`·`@nestjs/bull`, `passport*`)는 그 스크립트가 원본이다 — 여기서 따로 추론하지 않는다. `from`이 `기본값`인 영역은 "감지 안 됨(플러그인 기본 X)"으로 적는다.
  - Redis는 `ioredis`/`@nestjs/cache-manager` 존재 여부, 인증 전략 세부(`@nestjs/jwt`·refresh 등)는 package.json에서 보충한다
- **테스트**: `jest`/`supertest`/`@testcontainers/*`
- **패키지 매니저/Node**: lockfile + engines

## 이 스킬이 쓰는 절
`## BE 기술 스택`(자동 동기화) · `## BE 프로젝트 기술/라이브러리` · `## 공유 규약`, 그리고 공통 절(`## 개요`·`## 제약사항`·`## 도메인 용어`)은 없을 때만(`${CLAUDE_PLUGIN_ROOT}/docs/refs/artifact-contract.md`).

## 사용자 입력 (자동 미덮어씀)
- 개요, 제약사항, 도메인 용어
- **공유 규약**(FE 디자인 토큰 자리 대체): 에러 봉투 형태, 페이지네이션 규약, 인증 헤더 규약, API 버전 prefix, ValidationPipe 옵션
  - **정의서 동기화(D1):** 정의서(`docs/specs/definition.md`)가 있으면 그 전역 규약의 **URL 컨벤션/prefix**를 이 project-context의 API 버전 prefix와 **대조**해, 어긋나면 정의서를 SOT로 보고 경고(임의 변경 금지 — 사용자 확인). 정의서가 SOT이므로 새 prefix는 정의서에서 끌어온다.
- **프로젝트 기술/라이브러리**(전역 세트 외 추가): 전역 스킬 기본 세트 외에 이 프로젝트가 의도적으로 채택한 lib/기술 — 권위 있는 지시.

## 출력 객체
`{ overview, techStack, sharedConventions, constraints, domainGlossary, projectLibraries }`.
- `projectLibraries: string` — 전역 기본 세트 외 채택 lib (`"lib — 이유(연관 FR)"` 형식, 비어도 됨 `''`).

## projectLibraries 처리
- **자동 동기화(package.json) 대상이 아님 — 사용자 지시 보존.** 재실행 파싱 시 기존 내용을 절대 덮어쓰지 않는다.
- 재실행 파싱: `## BE 프로젝트 기술/라이브러리` 다음 블록(옛 형식 파일이면 `## 프로젝트 기술/라이브러리`)(괄호 안내문 줄 제외) → `projectLibraries` 복원. `(없음)`/빈 줄이면 `''`.
- 직렬화: 템플릿 `{{PROJECT_LIBRARIES}}`에 원문 그대로 채움(비면 `(없음)`).
- **최초 실행 시 이 섹션 전용 질문은 만들지 않는다** (선택적, 비어도 됨). 사용자가 적거나 dt-bespec 입력(요구사항/OpenAPI/문서)에 전역 세트 외 채택 lib가 명시되면 채운다.

## 출력
`templates-backend/project-context.md.tmpl`을 채운 내용을 `docs/project-context.md`에 **병합**한다. 모든 리소스 스펙이 이 규약을 참조(중복 금지).

**병합해 저장한다 — 파일 전체를 덮어쓰지 않는다.** 이 파일은 FE·BE 스킬이 함께 쓴다. 채운 템플릿을 `.dt-spec/project-context.rendered.md`에 쓰고 `node "${CLAUDE_PLUGIN_ROOT}/scripts/projectContextSync.mjs" merge --file docs/project-context.md --stack backend --from .dt-spec/project-context.rendered.md`로 합친다. BE 절만 바뀌고, 공통 절(개요·제약사항·도메인 용어)은 없을 때만 채워지며, 상대 스택의 절은 그대로 남는다. 종료 코드 3이면 **플러그인 형식이 아닌 파일**이다(옛 단일 템플릿, 또는 플러그인 전부터 있던 문서 — 제목·언어가 달라도 제목 키워드로 잡는다). 옆에 절을 붙이지 않고 멈춘다. `migrate --file docs/project-context.md --stack backend --root .` 미리보기를 보이고 한 번에 묻는다(원칙 6):
   - `옮김`: 제목만 플러그인 절 이름으로 바꾼다(내용 그대로) — 확인만 받는다.
   - `겹침`: 같은 자리의 플러그인 절이 이미 있다 — "옛 절 지우기(`--resolve drop`) / `옛 기록 — `으로 남기기(`--resolve keep`)"를 묻는다. 기본값은 keep(사람이 쓴 내용을 지우지 않는다).
   - `낡음?`: 적혔는데 `package.json`에 없는 기술 — 스크립트는 고치지 않는다. 그 줄을 고칠지 지울지 묻고, 답대로 고친다.
   - `그대로`: 플러그인 절과 대응하지 않는 절 — 손대지 않는다고 알린다.
   확인받은 뒤 `--write`(겹침이 있으면 `--resolve`와 함께)로 옮기고 다시 merge 한다.

