---
description: 요구사항·UX 소스에서 풀스택 웹앱을 이름 있는 단계(definition → be-spec → be-build → fe-spec → fe-build, 선택 e2e·audit·guide·handbook·wrap)로 한 흐름에 만든다. 단계마다 확인하며, 끊기면 진행 기록으로 이어간다.
argument-hint: '[--from <단계>] [--only <단계,…>] [소스…]'
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion, WebFetch
---

dt-fullstack 스킬을 실행한다. 자세한 절차는 `skills/dt-fullstack/SKILL.md` 참조.

Raw arguments: `$ARGUMENTS`

## 인자
- (없음): 시작할 때 선택 단계(e2e·wrap·audit·guide·handbook)를 고르게 하고 `definition`부터 진행한다. 진행 기록이 있으면 이어갈지 묻는다.
- `--from <단계>`: 그 단계부터 진행한다.
- `--only <단계,…>`: 그 단계들만 진행한다.
- `소스…`: 정의서·스펙에 쓸 Figma URL·문서 경로·링크. `definition` 단계에 넘긴다.

단계 이름: `definition` · `be-spec` · `be-build` · `fe-spec` · `fe-build` · `e2e` · `audit` · `guide` · `handbook` · `wrap`.
