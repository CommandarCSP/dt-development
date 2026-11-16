---
type: llm
focus: { source: file, path: docs/specs/pages/login/requirements.md }
---

요구사항 문서에는 401 에러 때 보여 줄 **문구가 없다**.
PASS if 401(로그인 실패) 에러 상태를 다루는 FR이 있고, 그 FR이 구체적인 에러 문구를 새로 지어내지 않는다 — 동작·접근성 시맨틱(예: role="alert", 에러 표시, 비밀번호 입력 비움)으로 적거나 문구를 캐논·미정으로 남긴다.
FAIL if 401 에러 FR이 없거나, 소스에 없는 구체 에러 문장(예: "이메일 또는 비밀번호가 올바르지 않습니다")을 확정 문구로 적는다.
