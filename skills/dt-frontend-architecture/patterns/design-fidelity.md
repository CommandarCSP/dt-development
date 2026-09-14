---
ruleId: design-fidelity
summary: "디자인 충실도 — 수거 에셋은 실제 파일로, 색은 디자인 토큰으로(임의 팔레트·플레이스홀더 금지)"
severity: important
appliesTo: ["src/components/**/*.{tsx,jsx}", "src/pages/**/*.{tsx,jsx}"]
excludePathPatterns: ["src/components/ui/**"]
detection:
  - type: forbidden-pattern
    pattern: "<img(?![^>]*\bsrc=)[^>]*>"
    rationale: "src 없는 <img> = 플레이스홀더 잔존. design.md ## 에셋 매니페스트의 실제 파일을 배선하라(플레이스홀더 금지)."
  - type: forbidden-pattern
    pattern: "\bsrc=(?:""|''|\{\s*(?:''|""|undefined|null)\s*\})"
    rationale: "빈 src = 플레이스홀더. 수거한 에셋(src/assets/<page>/ 또는 public/)을 실제로 참조하라."
  - type: forbidden-pattern
    pattern: "\b(?:bg|text|border|ring|fill|stroke|from|to|via|decoration|outline|shadow|divide|accent|caret|ring-offset)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b"
    rationale: "임의 Tailwind 팔레트(bg-blue-500 등) = 디자인 토큰 우회. globals.css @theme의 semantic 토큰 클래스(bg-primary·text-foreground)를 쓰라."
relatedRules: [no-hardcoded-design-values, view-styling]
overridable: true
overrideKey: design-fidelity
---

# 디자인 충실도 (Design Fidelity)

## 왜 중요한가
Figma에서 뽑은 디자인 값(테마 토큰·에셋)이 스펙 파일(`project-context.md ## 디자인 토큰`, `design.md ## 에셋 매니페스트`, 수거 파일 `docs/specs/assets/`)에 정착돼 있어도, 구현이 그 값을 **참조하지 않으면** 디자이너의 디자인이 "보이는 그대로" 나오지 않는다. 이 규칙은 구현이 정착된 디자인 값을 실제로 소비하도록 강제한다.

## 규칙 (정적 — review.mjs)
1. `src` 없는/빈 `<img>` 금지 — 매니페스트의 실제 에셋 파일을 배선. (미수거로 `(미수거)` 마킹된 것만 TODO 주석 허용)
2. 임의 Tailwind 팔레트 클래스(`bg-blue-500`·`text-gray-400` 등) 금지 — `globals.css @theme`의 semantic 토큰 클래스만.
3. 벤더 `src/components/ui/`는 제외.

## 크로스파일 검사 (시맨틱 — reviewer 에이전트 소관)
review.mjs가 per-file로 못 잡는 다음은 `reviewer`가 확인한다(reviewer.md):
- **테마 물질화 누락:** `docs/project-context.md ## 디자인 토큰`에 토큰이 있는데 `src/styles/globals.css`의 `@theme`(마커 블록)가 비어 있음 → 위반(`materialize-tokens.mjs` 미실행). hint: "테마 물질화 필요".
- **매니페스트 미배선:** `design.md ## 에셋 매니페스트`에 실 에셋이 있는데 컴포넌트가 그 파일을 참조하지 않음(플레이스홀더/누락) → 위반.

## override
디자인 소스(Figma)가 없는 프로젝트나 토큰/에셋 규율을 끄려면 `.dt-frontend.json`의 `overrides`에 `design-fidelity`를 넣는다. **`styling` override와 분리** — Tailwind 린트(view-styling·no-hardcoded-design-values)를 꺼도 충실도 게이트는 별도로 유지된다(기본 on).

## ❌ Incorrect
```tsx
<img alt="hero" />                         {/* src 없음 = 플레이스홀더 */}
<div className="bg-blue-500 text-gray-100" /> {/* 임의 팔레트 */}
```
## ✅ Correct
```tsx
import hero from '@/assets/feed/hero.png';
<img src={hero} alt="hero" />
<div className="bg-primary text-primary-foreground" />
```
