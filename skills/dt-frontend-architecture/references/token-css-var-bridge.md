# 디자인 토큰 → CSS변수 브리지 규약

`project-context.md ## 디자인 토큰`을 프로젝트 `src/styles/globals.css`의 `@theme` CSS변수(Tailwind v4)로 흘려보내는 규약.

**실제 생성**은 `skills/dt-frontend-scaffold/scripts/materialize-tokens.mjs`가 수행한다(결정적 파서+생성기). new-project(init)와 new-domain/extend-domain(Phase 0 재동기화)에서 `node materialize-tokens.mjs --project .`로 호출된다. 스크립트는 마커 블록(`/* dt:tokens:start */ … /* dt:tokens:end */`) 안에만 `@theme`를 재생성하고 마커 밖 사용자 편집은 보존한다(diff-then-confirm). 이 문서는 그 스크립트가 따르는 **매핑 규약**을 정의한다.

## 매핑
- 토큰 → `:root` CSS변수: `--color-primary`, `--radius-md`, `--spacing-*` …
- Tailwind theme(v4 `@theme`)는 CSS변수를 가리킨다: `--color-primary: …` ↔ `bg-primary`.
- semantic 우선: `--background`/`--foreground`/`--primary`/`--muted` 등 의미 토큰.

## 다크/멀티브랜드
- 다크: `.dark { --background: …; … }`
- 브랜드: `[data-theme="brand-b"] { --primary: …; --radius: … }`
- 컴포넌트는 의미 클래스(`bg-background`)만 쓰고, 변수 세트 스왑으로 테마 전환.

## 단일 출처
- 색/반경/간격은 CSS변수 토큰에만 정의. 컴포넌트 raw 값 금지(no-hardcoded-design-values).
