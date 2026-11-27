---
description: REST 리소스 하나의 BE 스펙(requirements·design·tasks·api-contract)을 OpenAPI·ERD/SQL·Markdown·PDF·웹 문서에서 만든다. docs/specs/resources/<resource>/에 쓴다
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

## 진입 동작
이 명령은 `dt-bespec-generate-spec` 스킬을 트리거한다. 스킬이 오케스트레이션:
- `dt-bespec-collect-project-context`
- `dt-bespec-analyze-openapi` (openapi 소스)
- `dt-bespec-analyze-datamodel` (sql/erd/datamodel 소스)
- `dt-bespec-analyze-document` (markdown/pdf/web 소스)
- `dt-bespec-ask-missing`

자세한 절차는 `skills/dt-bespec-generate-spec/SKILL.md` 참조.
