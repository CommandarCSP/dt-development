---
name: dt-bespec-analyze-datamodel
user-invocable: false
description: Use within dt-bespec to analyze ERD diagrams, SQL DDL, or data-model documents and extract entities, fields, types, relations, and constraints into Prisma-schema candidate models. Backend-only adapter (no frontend analog).
---

# dt-bespec Analyze Data Model

ERD / SQL DDL / 데이터 모델 문서에서 엔티티·관계·제약을 추출해 **Prisma 스키마 후보**를 만드는 어댑터.

## 입력
- `source`: `{ type: 'sql' | 'erd' | 'datamodel', locator, content }`
- `projectContext` (Prisma provider 등)

## 추출 (partial ExtractionResult)
```
dataModel: {
  entities: [{
    name, fields: [{ name, type, optional, default?, unique?, id? }],
    relations: [{ to, kind: '1:1'|'1:N'|'N:M', fk?, onDelete? }],
    indexes: [...],
    _provenance: { type, locator }, _inferred?: true
  }]
}
prismaSketch: "model X { ... }"           // api-contract.md의 Prisma 스케치로 직렬화
```

## 규칙
- SQL DDL은 결정론적으로 매핑(CREATE TABLE → model, 컬럼 타입 → Prisma 타입, FK → relation).
- ERD/산문 문서는 추론이며 `_inferred: true` + api-contract `[inferred]` 마커.
- 타입 매핑 모호 시(예: money/decimal precision) 비워 두고 ask-missing으로 확인.
- 데이터모델만 있고 OpenAPI가 없으면 api-contract는 **Case 2(구조적, draft)**.

## 경계
- 엔드포인트(HTTP)는 추론하지 않는다 — OpenAPI/문서 어댑터 소관. 단, 엔티티로부터 CRUD 엔드포인트 *후보*는 `_inferred`로 제안 가능.
