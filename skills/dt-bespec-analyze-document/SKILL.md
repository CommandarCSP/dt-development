---
name: dt-bespec-analyze-document
user-invocable: false
description: Use within dt-bespec to extract intent, flows, business rules, edge cases, and endpoint candidates from Markdown/PDF/web requirement documents for a backend resource. Returns a partial ExtractionResult; never fabricates API values.
---

# dt-bespec Analyze Document

Markdown/PDF/Web 요구사항 문서에서 의도·플로우·규칙·엔드포인트 후보를 추출하는 어댑터. (FE analyze-document를 백엔드 맥락으로 재사용)

## 입력
- `source`: `{ type: 'markdown' | 'pdf' | 'web', locator, content }` (사전 로드됨)
- `projectContext`

## 추출 (partial ExtractionResult)
```
userStories: [...]                         // "<역할>로서 <행위>를 통해 <목적>"
scenarios: [{ name, state }]               // 성공/실패/권한/충돌 경로
businessRules: [...]                        // 도메인 규칙·제약
edgeCases: [...]                            // 에러/예외 → Unwanted(error) 후보
apiCandidates: [{ featureName, kind, method?, endpoint?, confidence }]
```

## 규칙
- **구조는 추론 가능**(엔드포인트 필요성), **값은 명시된 것만**(method/endpoint/schema는 문서에 적혀 있을 때만 채움).
- 명시 안 된 항목은 빈 후보 + `confidence: 'ambiguous'` → ask-missing이 확인.
- 인증/권한 서술 → access control + State-driven EARS 후보.
- 결함/제약 서술 → edgeCases → Unwanted(error) EARS 후보.

## 경계
- DB 스키마 값(컬럼 타입)을 지어내지 않는다 — datamodel 어댑터 소관.
