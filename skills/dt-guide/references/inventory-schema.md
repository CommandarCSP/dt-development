# 참조: 기능 인벤토리 스키마 (`docs/guide/inventory.md`)

> 종류: **참조 문서(지식)** · 소비처: `guide-analyst`(쓰기), `guide-author`(읽기), `scripts/guide/inventory.mjs`(파싱·검증), 게이트 G2(왼쪽 항).
> SOT: 본 문서 + `scripts/guide/inventory.mjs`의 검증 규칙. 스펙 `docs/specs/2026-09-12-user-guide-skill-design.md` §5-2.

## 한 줄 원칙

분석 네 단계(스택 → 문서 → 코드·주석·테스트 → 질문)가 **이 파일 하나**를 채운다. 항목마다 어디서 알았는지 라벨을 붙인다. 기계가 읽는 부분은 front matter, 사람이 읽는 부분은 아래 표다.

## front matter (YAML 부분집합 — 스칼라·인라인 배열/맵·블록 배열/맵만)

| 키 | 필수 | 뜻 |
|---|---|---|
| `version` | ✓ | 마지막 analyze 시점의 프로젝트 `package.json` version |
| `analyzedAt` | ✓ | ISO 날짜 |
| `type` | ✓ | `web` \| `electron` |
| `product` | ✓ | 제품명(표지·PDF 파일명 근거) |
| `stack.router` | ✓ | 감지된 라우터 이름, 라우터가 없으면 `none`, **우리가 모르는 방식이면 `custom — <한 줄 설명>`**(AI가 코드에서 찾은 화면 전환 방식) |
| `stack.ui` · `stack.auth` · `stack.captureDriver` · `stack.startCommand` · `stack.url`(web) · `stack.mainEntry`(electron) | | 캡처 레시피 스캐폴딩 입력 |
| `scenarios[]` | ✓(빈 배열 허용) | 사용자가 하려는 일. `id: S<n>`, `title`, `steps: [SCR-…]`(화면 순서), `source: […]`, `publish?` |
| `screens[]` | ✓ | 화면. `id: SCR-<slug>`, `title`, `purpose`(한 줄), `route`(web: URL 경로 · electron: `view:<이름>` / `window:<이름>` / `external`), `entry: […]`(어디서 들어오나), `features: […]`, `auth: none\|login\|admin`, `capture: { mode, needs?, selector?, reason? }`, `publish`, `source: […]` |
| `prep` | ✓ | 준비물 체크리스트 값(`prep-checklist.md`의 키; 모르면 `null`) |

`scenarios`가 비면 `[]`(인라인 빈 배열)로 쓴다 — 빈 값으로 두면 `null`이 되어 검증에 실패한다.

파서는 YAML 전부가 아니라 부분집합만 읽는다. 앵커·멀티라인 스칼라는 쓰지 않는다. 주석은 ` #`(앞에 공백) 뒤부터다.

### 검증기가 실제로 막는 것

`inventory.mjs`가 없거나 어긋나면 곧바로 실패로 되돌리는 키는 다음뿐이다.

- 문서 수준: `version`(문자열) · `type`(`web`\|`electron`) · `product`(빈 문자열 불가) · `screens`(배열) · `scenarios`(배열)
- 화면마다: `id`(형식·중복) · `title` · `route` · `capture.mode`(허용값) · `capture.reason`(`mode: none`일 때) · `publish`(참/거짓) · `source`(한 개 이상)
- 시나리오마다: `id`(형식·중복) · `title` · `steps`(비지 않고, 모든 원소가 `screens`의 id) · `source`(한 개 이상) · `publish`(참/거짓)

표의 나머지 ✓는 검증기가 막지 않는 **규율**이다. 게이트가 통과시켜도 비워 두지 않는다 — `analyzedAt`·`stack.router`·`prep`이 비면 다음 판에서 같은 것을 다시 캐야 한다.

생략하면 채워지는 값도 있다. `capture`를 통째로 빼면 `mode: auto`, `needs`를 빼면 `[]`, `publish`를 빼면 `true`다. 비워 두는 편이 나은 자리에서만 생략한다.

### 라벨 (`source`)

| 라벨 | 뜻 | 재실행 시 |
|---|---|---|
| `stack` | 1단계 스택 감지에서 | 덮어씀 |
| `doc:<경로>#<제목>` | 2단계 문서에서 | 덮어씀 |
| `code:<파일:줄>` | 3단계 코드·주석에서 | 덮어씀 |
| `test:<파일>` | 3단계 테스트 이름·GWT에서 | 덮어씀 |
| `user-confirmed` | 4단계에서 사용자가 답함 | **보존**(덮어쓰지 않음) |
| `assumed:<사유>` | 무인 실행에서 조율자가 기본값으로 답함 | `needsDecision`으로 다시 올림 |

### 캡처 모드

| `capture.mode` | 뜻 | 게이트 G3 |
|---|---|---|
| `auto` | `capture.mjs`가 찍는다. `needs`(상태 준비 이름들)·`selector` | shot 파일 필수 |
| `manual` | 사람이 `docs/guide/shots/manual/<SCR-id>.png`를 둔다 | shot 파일 필수 |
| `none` | 그림 없이 글로만 안내(서드파티 로그인·외부 결제·OS 다이얼로그). `reason` 필수 | 면제 |

### id 규칙

- `S<n>`은 1부터, `SCR-<slug>`는 소문자·숫자·하이픈이며 첫 글자는 소문자나 숫자다(하이픈으로 시작하지 못한다). 재실행 때 같은 화면(같은 `route`)은 같은 id를 유지한다.
- 한 파일 안에서 id는 겹치지 못한다. 시나리오 `steps`에 적는 id는 모두 `screens`에 있어야 한다.
- `publish: false` 항목은 가이드·게이트 대상이 아니지만 **파일에 남긴다**(다음 판에 다시 묻지 않기 위해).

## 사람용 본문(표)

front matter 아래에 시나리오 표 `[id | 제목 | 화면 순서 | 출처]`와 화면 표 `[id | 제목 | 목적 | 경로 | 캡처 | 공개 | 출처]`를 둔다. 기계는 읽지 않는다.

## 검증

`node "${CLAUDE_PLUGIN_ROOT}/scripts/guide/build.mjs" <projectRoot> --gate-only`가 `inventory.md:` 로 시작하는 G0 메시지를 내면 스키마 위반이다. 위반 항목은 메시지가 짚는다.
