---
ruleId: view-styling
summary: "Tailwind 유틸리티 + cn()로 스타일링, inline style={{}}는 동적 값 한정"
severity: important
appliesTo: ["src/components/view/**/*.{ts,tsx}", "src/components/domain/**/*.{ts,tsx}"]
detection:
  - type: forbidden-import
    matches: ["**/*.scss", "**/*.sass", "**/*.css"]
    excludePatterns: ["**/globals.css"]
    rationale: "SCSS/CSS 모듈 import 금지 — Tailwind 유틸리티로 표현(전역 globals.css만 예외)"
relatedRules: [pure-view-component, no-hardcoded-design-values]
overridable: true
overrideKey: styling
---

# View/Domain은 Tailwind로 스타일링

## 왜 중요한가
- 스타일을 Tailwind 유틸리티 클래스로 표현해 별도 SCSS 파일·클래스명 관리를 없앤다
- 조건부/병합 클래스는 `cn()`(clsx + tailwind-merge)로 합쳐 충돌·중복을 제거한다
- 디자인 값은 토큰(CSS변수/Tailwind scale)으로만 — `no-hardcoded-design-values` 참조

## 규칙
1. 스타일은 Tailwind 유틸리티 className으로 작성
2. 조건부/가변 클래스는 `cn()`으로 병합 (예: `cn("px-4", isActive && "bg-primary")`)
3. SCSS/CSS 모듈 import 금지 — 전역 `globals.css`(토큰/리셋)만 예외
4. inline `style={{}}`은 **동적 CSS변수 주입 등 동적 값에 한정** (정적 스타일은 className으로)

## ❌ Incorrect
```tsx
import s from './PostCard.module.scss';
export function PostCard() { return <div className={s.card} style={{ padding: 16 }} />; }
```

## ✅ Correct
```tsx
import { cn } from '@/lib/utils';
export function PostCard({ active }: { active: boolean }) {
  return <div className={cn("rounded-md p-4 bg-card", active && "ring-2 ring-primary")} />;
}
```
