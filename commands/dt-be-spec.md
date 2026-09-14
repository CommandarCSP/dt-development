---
description: Build backend SDD spec documents (requirements.md/design.md/tasks.md/api-contract.md) for a REST resource from OpenAPI, ERD/SQL, and Markdown/PDF/Web sources. Outputs to docs/specs/resources/<resource>/.
argument-hint: '<locator> [<locator> ...] [--source <locator>] [--only requirements|design|tasks|api-contract]'
allowed-tools: Read, Write, Edit, Bash, Task, AskUserQuestion, WebFetch
---

Run dt-bespec to generate backend SDD spec documents for a resource.

Raw arguments: `$ARGUMENTS`

## 인자
- `<locator>` (1개 이상): 소스 locator. 종류:
  - OpenAPI 스펙 경로 (`.yaml`/`.json`)
  - ERD/SQL DDL/데이터모델 문서 (`.sql`, 데이터모델 `.md`)
  - 요구사항 문서 (`.md`/`.pdf`/URL)
- `--source <locator>`: 자동감지가 틀릴 때 `type:locator` prefix 사용 (예: `--source openapi:./api/weird.txt`)
- `--only requirements|design|tasks|api-contract`: 재실행 시 일부만 갱신.

## 흐름
1. 소스 해석: locator 파싱 + 타입 감지(.yaml/.json→openapi, .sql/erd→datamodel, .md/.pdf/url→document) → 콘텐츠 로드.
2. 프로젝트 컨텍스트 수집/조회 (`docs/project-context.md`).
3. 소스별 어댑터 분석: openapi→AnalyzeOpenApi / sql·erd→AnalyzeDataModel / 문서→AnalyzeDocument.
4. 2단계 머지 → `_conflicts` / `_possibleDuplicates`.
5. 충돌·중복 해소 + 누락 API 상세를 EARS 질문으로 채우기 (AskMissing).
6. `docs/specs/resources/<resource>/`에 4개 markdown 생성/갱신 (api-contract는 OpenAPI 유무로 Case 1/2/3 분기).

## 진입 동작
이 명령은 `dt-bespec-generate-spec` 스킬을 트리거한다. 스킬이 오케스트레이션:
- `dt-bespec-collect-project-context`
- `dt-bespec-analyze-openapi` (openapi 소스)
- `dt-bespec-analyze-datamodel` (sql/erd/datamodel 소스)
- `dt-bespec-analyze-document` (markdown/pdf/web 소스)
- `dt-bespec-ask-missing`

자세한 절차는 `skills/dt-bespec-generate-spec/SKILL.md` 참조.

## 재실행
기존 산출물이 있으면 헤더 sources를 복원해 union 후 diff + 사용자 confirm (자동 덮어쓰기 금지).
