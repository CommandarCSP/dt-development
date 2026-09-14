# 수정 버전(릴리즈/마일스톤) 매칭 규칙

Jira의 **수정 버전(fixVersions)** 필드를 프로젝트의 **릴리즈(마일스톤)**에 매칭해 채우는 규칙의 SOT다. 프로젝트에 릴리즈가 **정의돼 있을 때만** 동작한다(없으면 조용히 스킵 — 필드 비움).

## 릴리즈 목록 조회 (버전 전용 도구 없음)
공식 Atlassian MCP엔 프로젝트 버전 전용 조회 도구가 없다. **`getJiraIssueTypeMetaWithFields`**로 대상 이슈 타입(설정 `subtask`)의 필드 메타를 받아 `fixVersions.allowedValues`에서 릴리즈 목록을 얻는다:
- 각 항목: `{ id, name, description?, released, archived, releaseDate?, startDate? }`.
- `allowedValues`가 **빈 배열이면 릴리즈 미정의** → 이 단계 전체 스킵(필드 미기재).
- `archived: true`는 후보에서 제외. 이미 `released: true`인 버전은 후보 유지하되 우선순위 낮춤(보통 미래 마일스톤에 매칭).

## 매칭 기준 (의미 우선, 애매하면 사용자)
1. **의미(semantic) 매칭 우선** — 티켓의 **요약(summary)·작업 범위(What/Why)**를 각 릴리즈의 **이름·설명(description)**과 대조해 가장 잘 맞는 릴리즈 1개를 고른다. 릴리즈 이름/설명이 그 릴리즈에 담길 기능·범위를 서술하므로 이것이 1차 근거다.
2. **날짜(releaseDate)는 보조 신호** — 의미로 갈리지 않을 때만 tiebreaker로 쓴다(작업 완료일을 커버하는 가장 임박한 미출시 릴리즈).
3. **애매하면 무조건 사용자 확인** — 아래 중 하나라도 해당하면 자동 확정하지 않고 **사용자에게 묻는다**(워커면 `needsDecision`, 조율 흐름이면 dry-run 질문):
   - 신뢰할 만한 단일 매칭이 안 나옴(후보 0개 또는 2개 이상이 비등).
   - 티켓 범위가 여러 릴리즈에 걸침.
   - 릴리즈 이름/설명이 빈약해 의미 대조 근거가 약함.
   질문엔 후보 릴리즈(이름·releaseDate·설명 요약)를 제시하고 "매칭 안 함"도 선택지로 준다. **임의 추정 금지**(안전장치 2).

## 적용 대상·방법
- **대상: Sub-task**(설정 `fixVersionsTarget`, 기본 `subtask`). 마일스톤을 개발자 Sub-task에 단다. (부모 Story/Task엔 이 스킬이 손대지 않는다 — 필요 시 설정으로 변경.)
- **기재:** 매칭된 릴리즈를 `fixVersions` 배열로 넣는다. 생성 시 `createJiraIssue`의 `additional_fields`에 `{ "fixVersions": [ { "id": "<versionId>" } ] }`(id 우선, allowedValues에서), 기존 이슈면 `editJiraIssue`의 `fields`에 동일. **이름보다 id를 우선**(중복 이름·리네임 안전).
- **dry-run 표에 수정버전 열**로 매칭 결과(또는 "미매칭 — 확인 필요")를 노출하고 승인받는다(안전장치 1).

## 스킵 조건 (조용히)
- 프로젝트에 릴리즈 미정의(`allowedValues` 빈 배열) → 스킵.
- 매칭 사용자 확인에서 "매칭 안 함" 선택 → 필드 비움.
