---
description: 플러그인을 올린 뒤 프로젝트의 dt 산출물(스펙·정의서·project-context·interactions·플랜·원장·결정·설정)이 지금 형식과 맞는지 점검하고, 옮길 수 있는 것은 미리보기 → 확인 → 쓰기로 옮긴다.
argument-hint: '[<projectRoot>] [--resolve drop|keep] [--stack frontend|backend]'
allowed-tools: Read, Bash, Glob, AskUserQuestion
---

dt-migrate 스킬을 실행한다.

Raw arguments: `$ARGUMENTS`

## 동작
`skills/dt-migrate/SKILL.md`의 절차를 따른다. 도구는 `scripts/migrate.mjs`(점검·이전), 판정은 `scripts/artifactSchemas.mjs`, 정책은 `docs/refs/compat-policy.md`.
