---
name: dt-handbook
description: Use when the user wants a developer handbook for an existing codebase (인수인계서·코드 설명서·아키텍처 문서·핸드북 PDF) — "인수인계 문서 만들어줘", "코드 구조 설명서", "/dt-handbook". Extracts the static axis first (data owners, code clusters, boundaries, hotspots), then traces scenario call chains, writes an 8-chapter Korean handbook with mermaid and hand-drawn SVG figures, reviews it once, and builds a gated PDF into docs/handbook/. Engine lives in the plugin; only content lands in the project.
---

# dt-handbook — 코드 인수인계 핸드북 PDF (조율자)

> 산출(대상 프로젝트): `.dt-handbook.json` · `docs/handbook/inventory.md` · `structure.json` · `traces/*.json` · `handbook.md` · `ko-review.json` · `<Product>-Handbook.pdf` · `handbook-receipt.json`.
> 엔진은 플러그인(`${CLAUDE_PLUGIN_ROOT}/scripts/handbook/*`, `scripts/{entrypoints,depGraph,writeSites,hotspots}.mjs`, `templates/handbook-*`). 스펙: `${CLAUDE_PLUGIN_ROOT}/docs/specs/2026-09-14-handbook-skill-design.md`.

`dt-guide` 와 독자가 다르다. `dt-guide` 는 제품을 쓰는 사람에게 화면 사용법을, `dt-handbook` 은 코드를 물려받는 개발자에게 구조와 이유를 알려 준다.

## 불변 원칙

1. **정적 축이 먼저다.** 아키텍처는 데이터의 관리 주체, 코드가 뭉친 곳, 그렇게 된 이유로 이루어진다. 시나리오는 그 위에 얹는 층이지 척추가 아니다. 3·4·5·7장은 시나리오가 하나도 없어도 완성된다(G4 가 강제).
2. **조율자는 원자료를 읽지 않는다.** 코드 분석은 워커 컨텍스트에 가둔다. 조율자가 여는 파일은 설정·`inventory.md`·`handbook.md`·영수증뿐이다.
3. **질문은 조율자만 한다.** 워커는 `needsDecision` 으로 올리고, 묻는 쪽은 조율자다(`AskUserQuestion` 하나만 쓴다). 형식은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/askquestion-principle.md`.
4. **뼈대도 규칙을 탄다.** 장 제목·표 머리·그림 캡션은 본문과 같은 문체 규칙(묶음 D)을 지킨다. 특히 D6 — 직역한 학술 용어(`빌딩블록`·`런타임 뷰`·`횡단 관심사` 같은 arc42 목차 직역)를 제목에 쓰지 않는다. 제목은 본문보다 눈에 덜 띄어 규칙을 빠져나간다. 실제로 그렇게 한 판이 통째로 통과한 적이 있고, 그래서 플러그인 테스트가 **템플릿과 장 규격의 제목 자체를** 린트한다(`tests/handbookArtifacts.test.mjs`).
5. **사람이 읽을 글을 쓴다.** 낱말 규칙(A~D)을 다 지켜도 표가 절을 다 먹고 문장 길이가 균일하면 읽기 힘든 글이 된다. 묶음 E 가 그 층을 본다 — 표는 대조할 때만, 문장 길이는 섞어서, 절은 도입 한 문장으로, 독자에게 길 안내를. 린트가 매 빌드마다 검사한다(G6).
6. **처음 보는 사람 기준으로 쓴다(D8 독자 시험).** 문단마다 다섯 질문을 댄다 — 주장이 한 문장으로 나오나, 왜가 결론이 아니라 사실인가, 어긋나면 무엇이 눈에 보이나, 이 프로젝트에서만 쓰는 낱말을 풀었나, 숫자에 기준이 있나. 문장이 다 맞는데 읽는 사람이 납득하지 못하는 글은 대개 이 검사를 건너뛴 것이다.
7. **근거 없는 단정을 쓰지 않는다.** `[코드]`(`파일:줄`) · `[문서]`(티켓·위키) · `[추정]` 을 가른다. 이모지는 쓰지 않는다.
8. **범용이다.** 특정 프로젝트·스택을 전제하지 않는다. 스크립트는 힌트를 주고 판단은 워커가 한다.
9. **리뷰는 수렴할 때까지 돈다(최대 3회).** `ko-writing-reviewer`(`docType: 'handbook'`)를 격리해 부르되 한 번으로 끝내지 않는다. 고치면 새 위반이 생긴다 — 실제로 1차 반영 때 만든 깨진 문장이 재리뷰가 없어 PDF 까지 나갔다. **사람이 여러 번 시켜서 다듬은 글처럼 나오는 것이 기본값이어야 하고, 그 반복을 사용자가 대신 돌려 줘서는 안 된다.**
10. **게이트 먼저.** G0~G9 를 통과해야 PDF 를 낸다. 낡은 문서로 만든 PDF 는 나가지 않는다.
11. **외부 지식 원천은 선택이다.** Atlassian MCP 가 없어도 문서는 나온다. 없으면 품질만 낮아진다.
12. **단계를 기억으로 밟지 않는다.** §1 을 시작할 때 **체크포인트 3개와 한글 리뷰를 todo 로 만들어 놓고** 하나씩 지운다.

## 명령

```
/dt-handbook                      §0 → analyze → [CP1 구조] → [CP2 시나리오] → trace → write → 리뷰 → [CP3 초안] → build
/dt-handbook analyze|trace|write|build   그 단계만 (앞 단계 산출 파일이 있어야 함)
--flow "로그인, 문서 저장"          그 시나리오만
--area src/main/ipc                그 모듈만 (4·5장, 추적 안 함)
--section 5,6                      그 장만
--pdf-only-section 6               전권 + 그 장 발췌본 PDF
--max-flows N                      시나리오 상한 (기본 8)
--shots                            화면 캡처를 곁들인다 (dt-guide 캡처 엔진 재사용)
--no-figures                       그림 검사를 건너뛴 초안 PDF(파일명에 -draft) — 배포용 아님
--unattended                       무인
```

| 인자 | analyze | trace | write | build |
|---|---|---|---|---|
| (없음) | 전체 | 채택 시나리오 전부 | 8장 | 전권 PDF |
| `--flow "X"` | 건너뜀(기존 `structure.json` 사용) | X 만 | 6장의 X 절만 | 전권 PDF |
| `--area <경로>` | 그 경로만 | **안 돈다** | 4·5장만 | 전권 PDF |
| `--section 5,6` | 건너뜀 | 6장이 포함되면 채택 시나리오 | 그 장만 | 전권 PDF |

## 실행 모드

- **dispatched(기본)**: 조율자는 §0·체크포인트·질문·스크립트 실행만. 분석은 `Task` 로 `handbook-analyst`, 추적은 `handbook-tracer`(시나리오당 하나), 집필은 `handbook-author`, 한글 리뷰는 `ko-writing-reviewer`.
- **inline degrade**: 서브에이전트를 못 쓰면 조율자가 각 워커 파일의 「할 일」을 직접 밟고 한 줄 고지한다.

## 절차

### §0. 설정

1. `<projectRoot>/.dt-handbook.json` 이 없으면 `${CLAUDE_PLUGIN_ROOT}/templates/dt-handbook.json.tmpl` 로 만든다 — `{{PRODUCT}}` 는 `package.json` 의 `name`(사람이 읽는 이름이 따로 있으면 질문), `{{PDF_NAME}}` 은 ASCII `<Product>-Handbook.pdf`.
2. `docs/handbook/` 이 있으면 재실행이다: `inventory.md`·`structure.json`·`traces/*`·`handbook.md`·영수증의 유무를 표로 보이고, 있는 것은 `prior…Path` 로 워커에 넘긴다.
3. `.gitignore` 에 `.dt-handbook/`(스크래치)·`docs/handbook/handbook.html`·`docs/handbook/handbook-s*.html`(빌드 중간 산출)이 없으면 그 줄을 더한다(바꿀 줄을 보이고 확인 — 무인이면 더한 뒤 기록).
4. **외부 지식 원천 확인** — `sources.atlassian.enabled` 가 `off` 가 아니면 `mcp__atlassian__*` 도구가 있는지 본다. 없으면 **한 번만** 이렇게 알리고 그대로 진행한다.
   > Atlassian MCP 가 연결돼 있지 않다. 붙이면 "왜 이렇게 됐나"(2·4·8장)와 알려진 이슈를 티켓·설계 문서에서 가져올 수 있다. 없이도 문서는 나오지만 그 항목은 `[추정]` 으로 남는다.
   > 연결: `claude mcp add --scope user --transport http atlassian https://mcp.atlassian.com/v1/mcp` → `/mcp` 인증 → `/dt-handbook analyze` 재실행.
5. **무인 규칙** — 질문은 기본값으로 답하고 `assumed` 라벨을 붙인다. 체크포인트는 자동 승인으로 `.dt-handbook/progress.md` 에 적는다.

### §1. analyze

1. `handbook-analyst` dispatch — 입력 `{ projectRoot, config, priorInventoryPath?, area?, unattended }`. 반환 `{ inventoryPath, structurePath, needsDecision, summary }`.
2. `needsDecision` 이 있으면 **한 번에 묶어** `AskUserQuestion` 으로 묻는다(4개를 넘으면 나눈다). 답을 `answers` 로 실어 다시 dispatch 한다.
3. **[체크포인트 1] 구조 승인** — 군집 표·데이터 주인 표(주인이 둘인 것 강조)·경계 표·핫스팟 상위를 보이고 승인받는다. 여기가 틀리면 뒤가 전부 틀린다.
4. **[체크포인트 2] 시나리오 목록 승인** — [시나리오 · 진입점 · 근거(수입/자동) · 점수]를 보이고 가감받는다. 문서 비용이 여기서 정해진다. `--flow` 가 주어졌으면 그 목록으로 대신한다.

### §2. trace

1. 채택된 시나리오마다 `handbook-tracer` dispatch — 입력 `{ projectRoot, flow, structure, config }`. 여러 시나리오는 한 메시지에서 함께 보낸다.
2. 반환의 `partial: true` 는 결함이 아니다. 어디서 왜 끊겼는지를 모아 두었다가 체크포인트 3에서 함께 보인다.
3. `--area` 만 준 실행은 이 단계를 돌지 않는다.

### §3. write

1. `handbook-author` dispatch — 입력 `{ projectRoot, config, inventoryPath, structurePath, tracePaths, priorDraftPath?, sections? }`.
2. 워커는 `--gate-only` 를 스스로 3회까지 돌린다. 남는 findings 는 `gateFindings` 로 실어 **한 번만** 다시 dispatch 하고, 그래도 남으면 체크포인트 3에서 보인다.
3. **한글 리뷰(수렴 루프 — 최대 3회)** — 한 번으로 끝내지 않는다. 고친 자리가 새 위반을 만들기 때문이다.

   각 회차는 이렇게 돈다.
   1. `ko-writing-reviewer` dispatch `{ path: '<projectRoot>/docs/handbook/handbook.md', docType: 'handbook' }`. 2회차부터는 **직전 회차에 고친 범위**를 함께 알려 그쪽을 집중해 보게 한다.
   2. `after` 가 있는 finding 을 그 문장에 그대로 끼운다. `after` 가 비었거나 `needsHuman: true` 인 것은 **손대지 않고** 따로 모은다 — 이런 항목은 루프를 늘리지 않는다.
   3. 고친 뒤 기계 검사를 다시 돌린다: `node -e` 로 `lintKoWriting(본문, { docType: 'handbook' })`. 여기서 findings 가 나오면 **내가 고치다 새로 만든 것**이다.
   4. 멈추는 조건 — ① 리뷰어가 `OK` 를 주고 린트도 0건이거나 ② 남은 것이 전부 `needsHuman` 이거나 ③ 3회를 채웠다. 그 밖에는 다음 회차를 돈다.

   영수증 `docs/handbook/ko-review.json` 에 회차 기록을 남긴다 — `{ verdict, at, rounds: [{ n, applied, needsHuman, lintAfter }], bodyHash }`. `bodyHash` 는 **마지막으로 고친 뒤의** 본문(front matter 제외) sha256(`koReviewHash`). G7 이 이 파일을 본다. **`lintAfter` 가 0 이 아닌 채로 끝나면 G7 이 빌드를 막는다.**

4. **[체크포인트 3] 초안 승인** — 본문(길면 장 목록 + 그림 수), 리뷰 표, `coverage.missing`, `partial` 시나리오, 남은 게이트 findings 를 보이고 승인받는다.

### §4. build

1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/handbook/build.mjs" <projectRoot>` — 종료 코드 0 통과, 1 게이트 실패·렌더 오류, 2 사용법 오류. 점검만 할 때는 `--gate-only`.
2. 게이트가 막으면 findings 를 그대로 보이고 멈춘다.
   - **G1/G1-b** — front matter 와 본문의 버전을 `package.json` 에 맞춘다.
   - **G2** — 인벤토리에 있는 군집이 문서에 없다. 그 장을 다시 쓴다.
   - **G3** — 근거 파일·줄이 어긋난다. `파일:줄` 을 고치거나 `/dt-handbook trace --flow <이름>` 을 다시 돈다.
   - **G4** — 6장에만 있는 모듈이다. 4·5장에 그 모듈을 넣는다. 구조 장이 런타임 장에 얹혀 있다는 신호다.
   - **G5** — 머메이드 문법·A4 폭 초과·캡션 누락·손 SVG 6장 초과. 그림을 고친다.
   - **G6** — 문체. 이모지와 지시문은 BLOCK 이다.
   - **G7** — 한글 리뷰를 안 받았거나, 리뷰 뒤에 본문을 고쳤거나, 마지막 회차의 기계 검사가 깨끗하지 않다. §3-3 의 수렴 루프를 다시 돌고 영수증을 새로 남긴다.
   - **G8** — 토큰·이메일·개인 홈 경로가 보인다(`audience: external` 이면 티켓 키·위키 링크도). 가리거나, 제품이 일부러 보여 주는 값이면 `allowInQuotes` 에 적어 통과시킨다(그냥 통과와 적어서 통과는 다르다).
   - **G9** — 분석 이후 근거 파일이 바뀌었다. 메시지가 짚어 주는 명령을 그대로 돈다.
3. 통과하면 PDF·영수증 경로를 보인다. `--pdf-only-section N` 을 줬으면 발췌본 경로도 함께.
4. **가정 목록** — 이번 실행에서 `assumed` 가 붙은 항목을 표 [항목 · 고른 값 · 사유]로 모아 보인다.
5. **커밋은 사용자 몫이다** — 커밋할 목록을 보인다: `docs/handbook/**`, `.dt-handbook.json`, 바뀐 `.gitignore`. 스크래치 `.dt-handbook/` 와 중간 산출 `*.html` 은 대상이 아니다.

## 실패·폴백

- **워커를 못 쓰면** 조율자가 각 워커 파일의 「할 일」을 직접 밟고 한 줄 고지한다.
- **추적이 끊기면**(동적 디스패치·리플렉션) 그 시나리오는 `partial` 로 표시하고 거기까지만 적는다. 이어지는 흐름을 지어내지 않는다.
- **진입점을 하나도 못 찾으면** 그 프로젝트의 등록 방식을 워커가 코드에서 찾는다. 그래도 못 찾으면 시나리오 목록을 사용자에게 묻는다.
- **git 이력이 얕으면** 핫스팟·co-change 를 비우고 그 사실을 2장에 한 줄 적는다.
- **시나리오를 하나도 못 뽑으면** 6장을 비우고 나머지 7개 장으로 문서를 낸다. 원칙 1 대로 정적 축은 자립한다.
- **Playwright 가 없으면** PDF 를 못 만든다. 대상 프로젝트에 `@playwright/test` 를 넣을지 **확인 후** 설치한다. 점검만 할 때는 `--gate-only` 로 게이트만 돌린다.
- **머메이드를 못 띄우면** 배포용 PDF 를 내지 않는다. 오류를 그대로 보이고 `--no-figures`(초안용)를 안내한다.

## 관련

`dt-guide`(사용자용 가이드 — 캡처 엔진·PDF 골격 공유) · `dt-audit`(스펙 대비 감사, 이쪽은 스펙 없이 현재 코드를 설명) · `dt-explain`(문제 하나를 설명) · `ko-writing-reviewer`(같은 리뷰어, `docType: 'handbook'`).
