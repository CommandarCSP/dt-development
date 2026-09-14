---
description: Audit the implemented app against dt spec artifacts — as-built extraction per track(fe|be|ux), spec diff, git-based drift detection, action-oriented report to docs/audits/.
argument-hint: '[--scope fe|be|ux|spec|all] [--page <p>] [--resource <r>] [--app-url <url>] [--consult]'
allowed-tools: Read, Write, Bash, Grep, Glob, Task, AskUserQuestion
---

Run dt-audit to audit the implementation against dt spec artifacts.

Raw arguments: `$ARGUMENTS`

## 인자
- `--scope fe|be|ux|spec|all` (옵셔널): 감사 트랙. 미지정 시 스펙·프로젝트 마커 기반 자동 판별.
- `--page <p>` / `--resource <r>` (옵셔널, 반복 가능): 부분 감사 — 해당 페이지/리소스 검사 단위만.
- `--app-url <url>` (옵셔널): ux 트랙이 순회할 실행 중인 앱 주소. 없거나 접근 불가면 ux 트랙만 skip.
- `--consult` (옵셔널): 리포트 산출 후 질문 없이 협의 루프(§4)까지 진행. 미지정 시 리포트 후 1회 질문.
- `--scope spec`: 구현 코드 없이 정의서 ↔ leaf 스펙 전수 대조만 수행(문서 모순 검사).

## 진입 동작
이 명령은 `dt-audit` 스킬을 트리거한다. 스킬이 기준 스펙 인벤토리를 수집(§0)하고 트랙별
`auditor` 워커를 dispatch(§1), 크로스스택 병합(§2) 후 감사 리포트를 산출(§3)한다.

- 산출물: `docs/audits/YYYY-MM-DD-<scope>/report.md` + `traceability.md`
- 읽기 전용 — 코드·스펙을 수정하지 않는다. 수정 액션은 리포트 권고로만.

자세한 절차는 `skills/dt-audit/SKILL.md` 참조.

## 다음 단계
리포트의 code-fix 항목은 /dt-implement·/dt-be-implement(또는 수동 수정), spec-update 항목은
/dt-spec·/dt-be-spec·/dt-devspec 재실행으로 해소한 뒤 /dt-audit을 재실행하면 잔존이 줄어든다(수렴 루프).
협의 루프(§4)를 돌면 결정이 decisions.md에 남고, 스펙 보강은 역참조 마커와 함께 해당 스킬로 라우팅된다.
