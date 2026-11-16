---
description: 이미 만들어진 프로젝트를 정의서·스펙·결정 기록(PD)으로 들인다. 코드에서 근거와 함께 뽑고, 의도/버그를 묻고, 사람 확인을 거쳐 확정한다. 코드는 고치지 않는다.
argument-hint: '[<projectRoot>] [--fe <root> --be <root>] [--scope <화면·리소스,…>]'
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task, AskUserQuestion
---

dt-adopt 스킬을 실행한다. 자세한 절차는 `skills/dt-adopt/SKILL.md` 참조.

Raw arguments: `$ARGUMENTS`

## 인자
- `<projectRoot>`: FE·BE가 한 저장소면 그 루트(없으면 현재 폴더).
- `--fe <root> --be <root>`: FE·BE 저장소가 나뉘었을 때.
- `--scope <…>`: 일부 화면·리소스만 들일 때. draft로 남은 단위를 이어 들일 때도 쓴다.
