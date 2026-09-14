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
- **ORM**: `@prisma/client`/`prisma` → Prisma, `prisma.schema`의 `provider` → DB
- **Cache/Queue**: `ioredis`/`@nestjs/cache-manager`/`bullmq` 존재 여부
- **Auth**: `@nestjs/jwt`/`passport*` → 전략 추론
- **테스트**: `jest`/`supertest`/`@testcontainers/*`
- **패키지 매니저/Node**: lockfile + engines

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
- 재실행 파싱: `## 프로젝트 기술/라이브러리` 다음 블록(괄호 안내문 줄 제외) → `projectLibraries` 복원. `(없음)`/빈 줄이면 `''`.
- 직렬화: 템플릿 `{{PROJECT_LIBRARIES}}`에 원문 그대로 채움(비면 `(없음)`).
- **최초 실행 시 이 섹션 전용 질문은 만들지 않는다** (선택적, 비어도 됨). 사용자가 적거나 dt-bespec 입력(요구사항/OpenAPI/문서)에 전역 세트 외 채택 lib가 명시되면 채운다.

## 출력
`templates-backend/project-context.md.tmpl`을 채운 `docs/project-context.md`. 모든 리소스 스펙이 이 규약을 참조(중복 금지).
