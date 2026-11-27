---
description: 구현한 화면의 시나리오 수용 e2e(Playwright)를 쓰고 돌린다 — 화면 스펙·interactions.md에서 시나리오를 뽑아 원장으로 관리하고, 사람이 결과를 확인한다. /dt-implement 다음에 쓴다
argument-hint: '[<page|scope>]'
allowed-tools: Read, Write, Edit, Bash, Task, AskUserQuestion
---

Run dt-e2e to author and verify scenario-based acceptance e2e for a page or scope.

Raw arguments: `$ARGUMENTS`

## 인자
- `<page|scope>` (옵셔널): 대상 페이지 kebab 이름 또는 스코프. 생략 시 `docs/specs/pages/` 전체에서 미완 시나리오가 있는 대상을 제시.

## 진입 동작
이 명령은 `dt-e2e` 스킬을 트리거한다. 스킬이 페이지 스펙(`docs/specs/pages/<page>/{requirements,tasks}.md`)과 `docs/specs/interactions.md`에서 리스크 태깅된 시나리오를 도출→사용자 확인→Playwright spec 저작→사람 headed 검증을 반복한다.

자세한 절차는 `skills/dt-e2e/SKILL.md` 참조.
