---
description: 이 프로젝트에 dt-development 프론트엔드 리뷰(/dt-review)를 돌려 줘. 커버리지는 이 환경에서 못 돌리니 `full --no
tags: [review, fe]
runs: 1
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite]
append_system_prompt: "이 실행은 자동 평가다. 사용자에게 질문할 수 없다. 스킬이 사용자에게 물으라고 하는 선택은 권장안(없으면 가장 보수적인 선택)을 골라 진행하고, 완료 보고에 '가정'으로 적는다. 단, 기존 파일을 고치거나 지우기 전에 사람 확인(승인)을 받으라는 단계는 승인을 받지 못한 것으로 보고 그 쓰기를 하지 않는다. 정의서(definition.md)가 없으면 최소 정의서를 만들지 않고 standalone으로 진행한다. 네트워크는 쓸 수 없다."
---

이 프로젝트에 dt-development 프론트엔드 리뷰(/dt-review)를 돌려 줘. 커버리지는 이 환경에서 못 돌리니 `full --no-coverage` 로.
