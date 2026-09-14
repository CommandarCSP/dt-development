---
name: dt-bespec-analyze-openapi
user-invocable: false
description: Use within dt-bespec to analyze an OpenAPI/Swagger 3.x spec (yaml/json) and extract endpoints, HTTP methods, request/response schemas, status codes, and auth requirements into a partial ExtractionResult. This is the backend "precise" source (analogous to Figma for frontend).
---

# dt-bespec Analyze OpenAPI

OpenAPI/Swagger 3.x 스펙을 파싱해 **결정론적 API 계약**을 추출하는 어댑터. (FE의 analyze-figma 대응 — 정밀 소스)

## 입력
- `source`: `{ type: 'openapi', locator, content }` (yaml/json, 사전 로드됨)
- `projectContext`

## 추출 (partial ExtractionResult)
```
endpoints: [{
  method, path, operationId, summary,
  auth: 'none' | 'required' | 'role:<x>',
  requestSchema, responseSchema,         // $ref 해석
  statusCodes: [{ code, description, schema? }],
  _provenance: { type: 'openapi', locator }
}]
components: [{ name, schema }]            // schemas/components 정의
apiCandidates: [{ featureName, kind, method, endpoint, confidence: 'confident' }]
dataModel?: undefined                      // OpenAPI는 DB 모델을 직접 주지 않음 (datamodel 어댑터 담당)
```

## 규칙
- **값은 추출하되 지어내지 않는다**: 스펙에 없는 method/status/schema는 비워 두고 `confidence`를 낮춘다.
- `$ref`/`allOf`/`oneOf`를 해석해 평탄화한 스키마를 기록.
- `security` 블록 → endpoint `auth`로 매핑.
- 4xx/5xx 응답 → requirements의 Unwanted(error) 후보로 표시.
- OpenAPI가 존재하면 api-contract는 **Case 1(정밀)**.

## 경계
- DB 스키마(테이블/관계)는 추론하지 않는다 → `dt-bespec-analyze-datamodel` 소관.
- 비즈니스 규칙/플로우는 문서 어댑터가 보완.
