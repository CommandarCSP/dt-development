---
ruleId: no-hardcoded-design-values
summary: "생짜 hex 금지 — 토큰(CSS변수/Tailwind scale) 사용"
severity: important
appliesTo: ["src/components/**/*.{ts,tsx}"]
excludePathPatterns: ["src/components/ui/**"]
detection:
  - type: forbidden-pattern
    pattern: "#[0-9a-fA-F]{3,8}\b"
    rationale: "하드코딩 hex 색상 금지 — 디자인 토큰(CSS변수/Tailwind 색 클래스)로 표현"
relatedRules: [view-styling]
overridable: true
overrideKey: styling
---

# 디자인 값은 토큰으로

## 왜 중요한가
하드코딩된 색상은 테마/다크모드/브랜드 전환을 깨뜨린다. 색은 CSS변수 토큰(Tailwind 색 클래스가 가리키는)으로만 표현해 단일 출처를 유지한다.

## 규칙
1. 컴포넌트 코드에 raw hex(`#fff`, `#5659FF`) 금지
2. 색은 Tailwind 토큰 클래스(`bg-primary`, `text-muted-foreground`)로
3. 새 색이 필요하면 globals.css의 CSS변수 토큰으로 추가 후 사용
4. 벤더 `src/components/ui/`는 제외(검사 안 함)

## ❌ Incorrect
```tsx
<div style={{ color: '#5659FF' }} />
```
## ✅ Correct
```tsx
<div className="text-primary" />
```
