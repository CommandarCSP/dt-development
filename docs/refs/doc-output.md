# 문서 PDF 출력 설정 — 가이드·핸드북 공통

`/dt-guide`(`.dt-guide.json`)와 `/dt-handbook`(`.dt-handbook.json`)이 같은 키로 받는다. 읽는 곳은 `scripts/lib/docOutput.mjs`다. 키를 안 적으면 지금까지와 같게 나온다. 단, 티켓 키 판정은 기본이 꺼짐으로 바뀌었다(아래 §2).

| 키 | 값 | 기본 | 하는 일 |
|---|---|---|---|
| `language` | `ko` · `en` (그 밖의 값은 `en` 문구) | `ko` | PDF 틀의 문구와 `<html lang>` |
| `versionSource` | `auto` · `package.json` · `Cargo.toml` · `pyproject.toml` · `git-tag` · `file:<경로>` | `auto` | 게이트 G1이 비교할 프로젝트 버전 |
| `ticketKeyPattern` | 정규식 문자열 · `false` | 없음 | 공개 문서에서 막을 티켓 키 |
| `theme.accent` | CSS 색 (`#0a7`, `teal`, `rgb(…)`) | 기본 테마 색 | 강조색. 핸드북 그림의 강조색도 같이 바뀐다 |
| `theme.font` | 글꼴 이름 | Pretendard | 본문 글꼴. 뒤에 Pretendard가 남아 한글이 비지 않는다 |
| `theme.logo` | 문서 폴더 기준 그림 경로 | 없음 | 표지 맨 위 로고 |
| `pdf.pageSize` | `A4` · `A5` · `Letter` · `Legal` | `A4` | 용지. 핸드북 그림 폭 검사도 이 폭을 따른다 |
| `entrypoints.extraPatterns` | `[{ kind, pattern, flags?, ext? }]` | `[]` | 핸드북만. 진입점 패턴 추가(§4) |

틀린 값은 경고하고 기본값을 쓴다. 핸드북은 게이트에 `G0` MINOR로 보인다.

## 1. 언어

`language`는 PDF **틀**만 바꾼다 — 목차 제목(목차 / Contents), 문서 제목 꼬리(사용 안내 / User Guide · 개발 핸드북 / Developer Handbook), 핸드북 발췌 머리말, `<html lang>`. 본문은 작성 에이전트가 쓰고, 한글 검사·리뷰(가이드 G7, 핸드북 G6·G7)는 아직 언어와 상관없이 돈다. 영어 본문 파이프라인은 보류 중이다(로드맵 GEN-15·16).

## 2. 버전 출처

`auto`는 `package.json` → `Cargo.toml`(`[package]`·`[workspace.package]`) → `pyproject.toml`(`[project]`·`[tool.poetry]`) 순으로 처음 찾은 `version`을 쓴다. `git-tag`는 가장 가까운 태그에서 `x.y.z`를 뽑는다(`v1.2.3` → `1.2.3`). `file:VERSION`처럼 적으면 그 파일에서 처음 나오는 `x.y.z`를 쓴다.

- 가이드: 버전을 못 읽으면 G0로 막는다.
- 핸드북: `auto`로 못 찾으면 G1을 건너뛴다(버전이 없는 저장소도 있다). 출처를 직접 적었는데 못 읽으면 G1로 막는다.

## 3. 티켓 키

사외 문서에 사내 티켓 번호가 나가지 않게 막는 검사다(가이드 G5, 핸드북 `audience: external`의 G8). 아무 `대문자-숫자`나 막으면 `ES-2015`·`PEP-8`·`UTF-8` 같은 일반 표기가 걸린다. 그래서 **키 형식을 아는 경우에만** 막는다. 아래 순서에서 처음 찾은 것을 쓴다.

1. 문서 설정 `ticketKeyPattern` — 정규식 문자열(예: `"(?:SHOP|OPS)-\\d+"`). `false`면 끈다.
2. 트래커 설정(`.dt-worklog.json`·`.dt-worklog.local.json`)의 `defaultProjectKey` — `SHOP`이면 `SHOP-123`만 막는다.
3. 같은 파일의 `issueKeyPattern`.
4. 없으면 보지 않는다.

어느 패턴이든 `ISO`·`UTF`·`SHA`·`RFC`·`AES`·`HTTP`·`MP3`·`MP4`·`H2`·`CVE` 접두어는 넘긴다.

## 4. 진입점 (핸드북)

`/dt-handbook analyze`가 내장 패턴으로 찾는 진입점:

- Electron IPC(`ipcMain.handle` …), 앱 이벤트(`app.on`)
- React Router(`<Route path>`, `{ path, element }`)
- NestJS(`@Controller` + `@Get` …)
- Express·Koa(router)·Fastify — `app|server|fastify|api|router|routes|…Router` 가 `.get('/경로', 처리기)` 모양으로 부를 때
- Next.js(`next` 의존이 있을 때만) — `app/**/page.*`는 화면, `app/**/route.*`는 내보낸 `GET`·`POST` …, `pages/**`는 화면, `pages/api/**`는 HTTP
- CLI(`.command('…')`)

그 밖의 언어·프레임워크는 `entrypoints.extraPatterns`로 더한다. 첫 캡처 그룹이 진입점 이름이 된다. `ext`를 적으면 그 확장자 파일만 보고, JS 밖의 확장자도 읽는다.

```json
{
  "entrypoints": {
    "extraPatterns": [
      { "kind": "http", "pattern": "@app\\.route\\(\\s*['\"]([^'\"]+)", "ext": [".py"] },
      { "kind": "http", "pattern": "HandleFunc\\(\\s*\"([^\"]+)\"", "ext": [".go"] }
    ]
  }
}
```

틀린 정규식은 건너뛰고 분석 결과에 경고로 남긴다.

## 5. 테마 통째 바꾸기

색·글꼴·로고로 모자라면 기본 테마를 복사해 고친다 — 가이드는 `docs/guide/theme.override.html`, 핸드북은 `docs/handbook/theme.override.html`. 기본 테마는 `templates/guide-theme.html`·`templates/handbook-theme.html`이다. 자리표시자(`TITLE`·`VERSION`·`FONT_CSS`·`CONTENT`·`LANG`·`THEME_CSS`, 핸드북은 `FIGURES_CSS`도)를 남겨 두면 위 설정도 같이 먹는다.
