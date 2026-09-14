---
description: Author and verify scenario-based acceptance e2e (Jest+Supertest+Testcontainers) for implemented backend resources, driven by resource specs (api-contract.md). Human verifies by reviewing ledger↔test diff plus green run; scenarios tracked in a status ledger. Runs after /dt-be-implement.
argument-hint: '[<resource|scope>]'
allowed-tools: Read, Write, Edit, Bash, Task, AskUserQuestion
---

Run dt-be-e2e to author and verify scenario-based acceptance e2e for a backend resource or scope.

Raw arguments: `$ARGUMENTS`

## 인자
- `<resource|scope>` (옵셔널): 대상 리소스 kebab 이름. 생략 시 `docs/specs/resources/` 전체에서 미완 시나리오가 있는 대상을 제시.

## 진입 동작
이 명령은 `dt-be-e2e` 스킬을 트리거한다. 스킬이 리소스 스펙(`docs/specs/resources/<resource>/api-contract.md` + requirements.md)에서 리스크 태깅된 시나리오를 도출→사용자 승인→Jest+Supertest+Testcontainers 테스트 저작→사람 검증(원장↔테스트 diff 리뷰 + 그린 확인)을 반복한다.

자세한 절차는 `skills/dt-be-e2e/SKILL.md` 참조.
