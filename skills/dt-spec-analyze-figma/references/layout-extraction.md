# layoutTree 추출 방법론 (단일 출처)

AnalyzeFigmaFrame이 `layoutTree`를 빌드할 때 따르는 규칙. antd/Tailwind 의존부를 뺀 프레임워크-독립 방법론(원본: figma-frame-to-code-guideline.md §3.6~3.11을 이식).

## 입력 데이터 출처

| 도구 | 반환 | 용도 |
|---|---|---|
| `get_design_context({ nodeId, fileKey })` | reference 코드 문자열(레이아웃=className/inline) + 동봉 스크린샷 + asset URL | 코드 파싱 → `containerLayout`/`visualStyle`/`text`; 스크린샷 = 아이콘 의미·text-align·variant·gap 추정 시각 근거 |
| `get_metadata({ nodeId, fileKey })` | XML(id/type/name/position/size) | 절대좌표·크기·형제 순서(z-order) 권위 출처 |

좌표 구조화 JSON은 없다. **코드 문자열 파싱 + metadata XML 병합**이 빌드 메커니즘.

## 추출 → 판정 → 직렬화 순서 (강제)

1. **추출**: 코드 문자열에서 레이아웃 클래스/inline(gap/padding/direction/align/justify/flex-wrap/text-align)·색·타이포·텍스트를 읽고, metadata XML에서 좌표·크기·형제 순서를 병합.
2. **판정**: 케이스1/2 분류, leaf/composite 경계, role enum 할당, 도메인 경계, 아이콘 의미, 반복 패턴.
3. **직렬화**: layoutTree 노드로 출력.

## 케이스 분류

| 케이스 | 단서 | 처리 |
|---|---|---|
| 케이스1 (정밀) | wrapper에 flex/grid + gap 명시, 자식이 흐름 배치 | 레이아웃 클래스를 값 그대로 inline style로 |
| 케이스2 (폴백) | wrapper는 relative, 자식이 absolute left/top | 좌표 분석으로 flex 변환 |
| 케이스2-B (행 그룹화) | wrapper 없이 부모 직계 자식이 모두 absolute, 일부 형제가 동일 top 공유 | 동일 top(±4px)으로 클러스터링 후 각 행 그룹에 케이스2 적용 |

## gap 폴백 사다리 (결정적 계산 우선, 추정은 마커)

- ① **좌표+크기 역산(결정적)**:
  - 세로: `다음 자식 top - (현재 자식 top + height)`
  - 가로: `wrapper width - 마지막 자식 left`로 마지막 자식 width 역산 → 인접 자식 좌표차로 gap 산출
- ② 역산 불가/추정 → **CASE-2 마커 + 출현 순서 flex**
- ③ 좌표 자체 없음 → **absolute 좌표 보존**(마커 불필요)

(균등 간격 스냅 등 *추가 추정*은 비결정성을 키우므로 도입하지 않는다.)

## 정규 마커 (리터럴 고정 — 테스트가 이것만 assert)

- CASE-2: `{/* ⚠️ CASE-2 [node:<id>] auto-layout 미적용 — gap <N>px 추정. 디자인 확인 권장 */}`
- INCOMPLETE: `{/* ⚠️ INCOMPLETE [node:<id>] 시각 정보 부족 — 코드/메타에서 레이아웃 추출 실패 */}`

## role closed enum

`button` · `icon-button` · `link` · `input` · `select` · `textarea` · `checkbox` · `radio` · `toggle` · `column-header` · `icon` · `image` · `text` · `badge` · `tag` · `avatar` · `divider` · `unknown`

역할별 필수 부속 키:

| role | 부속 키 |
|---|---|
| `input` | `inputType` |
| `select` | `options`(쉼표 목록 또는 `options=?`) |
| `textarea` | `placeholder` |
| `checkbox`/`radio`/`toggle` | `checked` |
| `icon`/`icon-button` | `icon`(불확실 시 `icon=?`+후보) |
| `link` | `href`(없으면 `href=?`) |
| `image` | `alt`(레이어명 유추, 불확실 시 `alt=?`) |
| `column-header` | `sortable`, `sortKey` |
| 그 외 | 없음 |

인터랙션 단서(옵셔널): `onAction=<의미>`(예: `onAction=delete-row`). 핸들러 본문은 만들지 않는다.

## 주석 형식 (tsx 유효성)

- JSX 자식 위치 → 반드시 `{/* */}`. `//` 불가.
- JS 본문 위치(function 바디) → `//` 허용.

## 펼침 깊이 / 도메인 경계

- leaf UI 원자만 placeholder로 접는다. 컴포지트(Table/Card/List)는 내부 레이아웃을 끝까지 펼친다.
- 각 컴포지트 wrapper에 `{/* domain-boundary: <Name> */}`. 중첩 시 `{/* domain-boundary: <Name> (nested in <Parent>) */}`.
- 표시 전용 composite는 변환 시 View일 수 있다(경계는 후보 힌트).
- 반복 데이터는 1샘플 + `{/* 반복: <data>.map(...) — TODO: 실제 API 데이터 */}`.

## 오버레이·겹침

그려진 오버레이(Toast/고정 바/모달)는 `position`+좌표+z-order 보존. z-order는 metadata 형제 순서(뒤=작은 인덱스) 1차 근거, 스크린샷 검증용. 스크롤 영역 보이면 `{/* overflow: auto 영역 */}`.

## width/height·아이콘·에셋·토큰

- width/height: 케이스1 미기입(반응형), 케이스2 기입.
- 아이콘/이미지/로고(에셋 충실도): Step 1 `download_assets`로 **실제 파일**을 `docs/specs/assets/<page>/`에 저장하고, placeholder는 그 **로컬 경로를 참조**한다(예: `{/* icon: menu → assets/<page>/icon-menu.svg */}`, `<img src="assets/<page>/hero.png" alt=... />`). Figma asset **URL**(만료됨)이나 raw SVG path 원문을 스켈레톤에 박지 않는다 — 로컬 파일 경로만. 다운로드 못 한 에셋만 의미 주석(`icon=?`+후보 1~2개)으로 강등. 매니페스트(node→로컬경로→용도)는 `assets[]`로 반환 → `design.md ## 에셋 매니페스트`.
- 전역 색/타이포/간격/shadow 토큰은 `docs/project-context.md` `## 디자인 토큰` 참조(값 중복 금지).

## 범위 제외

그려지지 않은 숨은 상태(로딩/빈/에러/권한없음/hover)는 스켈레톤에 포함하지 않는다(후속 작업).
