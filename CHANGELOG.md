# 변경 기록

이 플러그인의 바뀐 점을 버전별로 적는다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를 따르고, 버전의 뜻은 [호환 정책](docs/refs/compat-policy.md)이 정한다.

- 바꿀 때마다 맨 위 **미출시** 절에 적는다. 버전을 올릴 때 `node scripts/release.mjs <patch|minor|major>`가 이 절을 그 버전 절로 바꾼다.
- **산출물 형식 변경** 절은 사용자 프로젝트에 이미 있는 파일(스펙·project-context·설정 등)에 영향이 있을 때 쓴다. 옮기는 방법(`/dt-migrate`)이나 "옮길 필요 없음"을 함께 적는다.

## [미출시]

## [0.15.0] - 2026-11-16

### 추가
- `/dt-adopt` — 기존 프로젝트를 정의서·스펙·결정 기록으로 들인다. 워커 `adopt-extractor`, 기계 추출 `scripts/adopt/` (GEN-29)
- `/dt-decision` — 팀 정책(TP)·프로젝트 결정(PD) 기록. 규칙을 끄는 override에는 근거 결정이 필요하다 (GEN-21)
- 공통 설정 `.dt.json`(`hooks`·`team.*`·`decisions.sharedDir`)과 공용 로더, `dt-wrap --init` (GEN-03, GEN-29)
- 스택 사전 점검 — 플러그인 기본 기술과 다르면 영역별로 묻고 PD로 남긴다 (GEN-31)
- 산출물 형식 검사기 `validateSpec.mjs`, 정의서 정합 게이트 `checkDefinitionDrift.mjs` (GEN-22, GEN-23)
- `dt-fullstack` 이름 있는 단계·선택 단계(e2e·감사·가이드·핸드북·마무리)·재개, `/dt-fullstack` (GEN-37)
- e2e 작성 워커 `e2e-author` (GEN-39)
- Atlassian MCP 도구 대응표 `docs/refs/atlassian-mcp.md` — v1·v2 모두 동작 (GEN-42)
- 버전 올리기 `scripts/release.mjs`, 이 변경 기록, 호환 정책, 산출물 형식 점검 `/dt-migrate` (GEN-25)
- 전체 테스트·CI, 플러그인 구조 검사, 금칙어 스캐너 (GEN-01, GEN-19, GEN-20)

### 변경
- 에이전트↔조율자 공용 프로토콜(반환 봉투·needsDecision·질문 묶음) — 에이전트 16개가 따른다 (GEN-35)
- 스펙 작성이 빈틈·모호함을 스스로 찾아 되묻고, 나머지는 가정으로 보고한다 (GEN-30)
- 리뷰어 dispatch·수리 루프를 빌더에서 조율자로 올렸다 — 격리 리뷰 (GEN-36)
- 막혔을 때 그만두지 않고 선택지(복구·우회·이어서 실행·중단)를 준다 (GEN-32)
- 게이트: 건너뜀은 실패, 규칙 검출 구현 (GEN-23). draft 구현 규칙, 스택 버전 고정 설치, 플랜 최신 여부(`specHash`), 정의서 계약 해시 버전 (GEN-24)
- FE 스펙도 FR 줄에 정의서 결속 `<!-- from: IF-n -->`를 단다 (GEN-29)
- `/dt-review`·`/dt-be-review`가 스킬 절차(설정 부트스트랩)를 따른다 (GEN-33)

### 고침
- FE·BE가 같은 `project-context.md`를 서로 덮어쓰던 것 (GEN-34)
- 형식 검사기가 이미 쓰던 스펙(옛 표 열 이름·원장 마커 없음)을 막던 것, 통합 `radix-ui` 패키지 미감지 (GEN-22·23 후속)
- Atlassian MCP v2에서 없어진 v1 도구를 부르던 것, 명령의 도구 허용 누락 (GEN-42)

### 산출물 형식 변경
- `docs/project-context.md` — 절 이름에 스택 접두어(`## FE 기술 스택` 등). 옛 형식·플러그인 밖 문서는 다음 스펙 작성 때 멈추고 옮길지 묻는다. 미리 보려면 `/dt-migrate`.
- `docs/specs/interactions.md` — `## FE 크로스페이지`·`## BE 크로스리소스` 절로 나뉜다. 옛 형식은 `/dt-migrate`가 FE 절 아래로 모은다.
- 새로 만드는 md·설정에 형식 버전 표시(`<!-- dt-schema: 종류@N -->`·`"$schemaVersion"`)가 붙는다. 없는 기존 파일은 구조로 판정하므로 **옮길 필요 없다**.
- 스펙(`specVersion` 1.1)·정의서(1.2) 형식은 바뀌지 않았다.

## [0.14.0] - 2026-09-29
- 사내판 0.14.0 반영 — 결정 로그 주석 규칙, worklog 릴리즈 마일스톤

## [0.13.0] - 2026-09-15
- `dt-handbook` — 코드 인수인계 핸드북 PDF

## [0.12.0] - 2026-09-14
- 설정이 없으면 스킬이 물러나지 않고 만들고 계속한다

그 이전은 git 기록을 본다.
