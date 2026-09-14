---
ruleId: be-e2e-scenarios-required
summary: "리소스 스펙(requirements.md)은 있는데 수용 e2e 원장(*.e2e-scenarios.md)이 없는 리소스를 존재 안전망으로 경고(머지 차단 아님)"
severity: minor
appliesTo: ["src/**/*.controller.ts"]
detection:
  - type: requires-acceptance-ledger
    specsDir: "docs/specs/resources"
    nudge: "/dt-be-e2e"
    description: "docs/specs/resources/*/ 중 requirements.md는 있으나 *.e2e-scenarios.md 원장이 없는 디렉토리를 찾아 경고. /dt-be-e2e 실행을 권장."
relatedRules: [e2e-full-app, controller-integration-supertest]
---

# BE 수용 e2e 원장 존재 안전망 (advisory)

BE 스캐폴드는 개발단 e2e를 자동 생성하지 않는다(수용 레이어 통합). 리소스 스펙이 있는데 수용 원장이 없으면 `/dt-be-e2e`를 깜빡한 것일 수 있어 minor로 알려만 준다 — 형식적 e2e 양산을 막기 위해 차단하지 않는다(결정은 사람).

검사 기준이 컨트롤러 파일이 아니라 **스펙 디렉토리**인 이유: FE와 동일 — 파일명↔원장명 기계 매핑이 불확실하고, 스펙 있는 리소스만이 수용 e2e 대상이다(스펙 기반 하드 요구).
