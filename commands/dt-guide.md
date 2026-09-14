---
description: Generate an end-user guide PDF for a web-frontend or Electron project — analyze the project in four stages, screenshot screens, draft a Korean guide (reviewed once), and build a gated PDF into docs/guide/.
argument-hint: '[analyze|capture|write|build] [--type web|electron] [--unattended]'
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
---

dt-guide 스킬을 실행해 사용자 가이드 PDF 를 만든다.

Raw arguments: `$ARGUMENTS`

## 인자
- (없음): analyze → 인벤토리 승인 → capture → write → 초안 승인 → build 를 한 번에 돈다.
- `analyze` | `capture` | `write` | `build`: 그 단계만 돈다(앞 단계 산출 파일이 있어야 한다).
- `--type web|electron`: 프로젝트 타입을 강제한다(`.dt-guide.json` 에 적힌다).
- `--unattended`: 사람 없이 돈다 — 질문은 기본값으로 답하고 `assumed` 로 표시, 체크포인트 두 개는 자동 승인으로 기록, 패키지 설치는 사전 허용으로 본다. **사용자가 미리 허용했을 때만** 쓴다.

## 동작
`dt-guide` 스킬의 절차(§0 설정 → §1 analyze → §2 capture → §3 write → §4 build)를 따른다.
분석은 `guide-analyst`, 집필은 `guide-author` 워커에 맡기고, 한글 리뷰는 `ko-writing-reviewer` 1회다.
사람이 멈춰 서는 자리는 인벤토리 승인과 초안 승인 두 곳뿐이고, 질문은 조율자가 `AskUserQuestion` 으로만 묻는다.
산출물은 대상 프로젝트 `docs/guide/` 에 남고, 커밋은 사용자가 한다.
