---
description: Generate a developer handbook PDF for an existing codebase — extract the static axis (data owners, clusters, boundaries, hotspots), trace scenario call chains, write an 8-chapter Korean handbook with figures, and build a gated PDF into docs/handbook/.
argument-hint: '[analyze|trace|write|build] [--flow "이름"] [--area <경로>] [--section 5,6] [--pdf-only-section N] [--max-flows N] [--shots] [--unattended]'
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
---

dt-handbook 스킬을 실행해 코드 인수인계 핸드북 PDF 를 만든다.

Raw arguments: `$ARGUMENTS`

## 인자
- (없음): analyze → 구조 승인 → 시나리오 승인 → trace → write → 한글 리뷰 → 초안 승인 → build 를 한 번에 돈다.
- `analyze` | `trace` | `write` | `build`: 그 단계만 돈다(앞 단계 산출 파일이 있어야 한다).
- `--flow "로그인, 문서 저장"`: 그 시나리오만 추적하고 6장의 해당 절만 갱신한다.
- `--area <경로>`: 그 모듈만 본다. 4·5장만 갱신하고 시나리오 추적은 돌지 않는다.
- `--section 5,6`: 그 장만 다시 쓴다.
- `--pdf-only-section N`: 전권 PDF 와 함께 그 장만 뽑은 발췌본 PDF 를 낸다(전권 어느 판에서 뽑았는지 박힌다).
- `--max-flows N`: 시나리오 상한(기본 8).
- `--shots`: 화면 캡처를 곁들인다(`dt-guide` 캡처 엔진 재사용, Playwright 필요).
- `--no-figures`: 그림 검사를 건너뛴 초안 PDF. 파일명에 `-draft` 가 붙는다. 배포용이 아니다.
- `--unattended`: 사람 없이 돈다 — 질문은 기본값으로 답하고 `assumed` 로 표시, 체크포인트 3개는 자동 승인으로 기록한다. **사용자가 미리 허용했을 때만** 쓴다.

## 동작
`dt-handbook` 스킬의 절차(§0 설정 → §1 analyze → §2 trace → §3 write → §4 build)를 따른다.
정적 축(데이터 주인·군집·경계·핫스팟)을 먼저 세우고 시나리오는 그 위에 얹는다 — 3·4·5·7장은 시나리오가 없어도 완성된다.
분석은 `handbook-analyst`, 추적은 시나리오당 `handbook-tracer`, 집필은 `handbook-author` 에 맡기고, 한글 리뷰는 `ko-writing-reviewer` 1회다.
사람이 멈춰 서는 자리는 구조 승인·시나리오 승인·초안 승인 세 곳이고, 질문은 조율자가 `AskUserQuestion` 으로만 묻는다.
산출물은 대상 프로젝트 `docs/handbook/` 에 남고, 커밋은 사용자가 한다.
