---
description: docs/req/login.md 를 소스로 login 페이지의 SDD 스펙을 만들어 줘. dt-development 플러그인의 dt-spec 절
tags: [spec, fe, slow]
runs: 1
max_turns: 120
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
append_system_prompt: "이 실행은 자동 평가다. 사용자에게 질문할 수 없다. 스킬이 사용자에게 물으라고 하는 선택은 권장안(없으면 가장 보수적인 선택)을 골라 진행하고, 완료 보고에 '가정'으로 적는다. 단, 기존 파일을 고치거나 지우기 전에 사람 확인(승인)을 받으라는 단계는 승인을 받지 못한 것으로 보고 그 쓰기를 하지 않는다. 정의서(definition.md)가 없으면 최소 정의서를 만들지 않고 standalone으로 진행한다. 네트워크는 쓸 수 없다."
---

docs/req/login.md 를 소스로 login 페이지의 SDD 스펙을 만들어 줘. dt-development 플러그인의 dt-spec 절차(`dt-spec-generate-spec` 스킬)를 따른다.

스펙을 다 쓴 뒤, 플러그인의 `scripts/validateSpec.mjs` 로 `docs/specs/pages/login/` 아래 .md 파일을 `--json` 으로 검사하고 그 출력 그대로를 `eval-validate.json` 에 저장해 줘.
