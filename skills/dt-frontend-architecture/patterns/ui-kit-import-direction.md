---
ruleId: ui-kit-import-direction
summary: "components/ui(벤더 프리미티브)는 domain/business/store/services import 금지"
severity: critical
appliesTo: ["src/components/ui/**/*.{ts,tsx}"]
detection:
  - type: forbidden-import
    matches: ["**/components/domain/**", "**/business/**", "**/store/**", "**/services/**"]
    rationale: "ui-kit은 앱 레이어를 모름 — 의존 역전 방지(feature → ui 단방향)"
relatedRules: [pure-view-component]
---

# ui-kit은 앱 레이어를 import하지 않는다

## 왜 중요한가
`src/components/ui/`는 shadcn/Radix 기반 벤더 UI 프리미티브로, 앱의 도메인·상태·서비스를 몰라야 재사용·교체가 가능하다. feature 레이어(View/Domain)가 ui를 import하는 단방향만 허용한다.

## 규칙
1. `components/ui/` 파일은 domain/business/store/services를 import 금지
2. 데이터·콜백은 props로 주입받는다(순수 UI)
3. View/Domain → ui 단방향 import만 허용

## ❌ Incorrect
```tsx
// src/components/ui/button.tsx
import { usePostListQuery } from '@/store/queries/posts/usePostListQuery';
```
## ✅ Correct
```tsx
// src/components/ui/button.tsx — props만
export function Button(props: ButtonProps) { /* ... */ }
```
