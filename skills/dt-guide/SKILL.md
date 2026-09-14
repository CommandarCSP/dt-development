---
name: dt-guide
description: Use when the user wants an end-user guide (사용자 가이드·사용 설명서·매뉴얼 PDF) for a web-frontend or Electron project — "가이드 만들어줘", "사용 설명서 PDF", "/dt-guide". Analyzes the project in four stages (stack → docs → code·comments·tests → questions), writes docs/guide/inventory.md, scaffolds a capture recipe, screenshots screens with Playwright, drafts a Korean guide reviewed once by ko-writing-reviewer, and builds a gated PDF into docs/guide/. Engine lives in the plugin; only content lands in the project.
---

# dt-guide — 사용자 가이드 PDF 생성 (조율자)

> 산출(대상 프로젝트): `.dt-guide.json` · `docs/guide/inventory.md` · `docs/guide/capture.config.mjs` · `docs/guide/shots/*.png` · `docs/guide/shots/capture-receipt.json` · `docs/guide/guide.md` · `docs/guide/ko-review.json` · `docs/guide/<Product>-User-Guide.pdf` · `docs/guide/guide-receipt.json`.
> 엔진은 플러그인(`${CLAUDE_PLUGIN_ROOT}/scripts/guide/*`, `${CLAUDE_PLUGIN_ROOT}/scripts/surfaceInventory.mjs`, `${CLAUDE_PLUGIN_ROOT}/templates/guide-theme.html`). 스펙: `${CLAUDE_PLUGIN_ROOT}/docs/specs/2026-09-12-user-guide-skill-design.md`.

## 불변 원칙
1. **범용(D13)** — 웹 프런트·Electron이면 어떤 프로젝트든. 라우팅·화면 전환·인증·기동은 프로젝트마다 다르니 **스크립트는 힌트, 판단은 워커(AI)**. 이 스킬·워커 본문은 특정 프로젝트를 전제하지 않는다.
2. **조율자는 읽지 않는다** — 코드·문서 원자료는 워커 컨텍스트에 가둔다. 조율자가 여는 파일은 `.dt-guide.json`·`inventory.md`·`guide.md`·수령증·`capture.config.mjs`뿐이다. 더 봐야 하면 워커에 다시 맡긴다.
3. **사람 승인 지점(체크포인트)은 정확히 두 개**(D11) — 인벤토리·초안. 설정 질문(§0)·설치 확인(§2-1)은 체크포인트가 아니라 확인이고, 무인 실행에서는 아래 기본값으로 대신한다. 캡처·빌드는 멈추지 않는다.
4. **단계를 기억으로 밟지 않는다** — §1~§4를 시작할 때 **체크포인트 2개와 한글 리뷰를 todo 로 만들어 놓고** 하나씩 지운다. 실제로 한 판에서 §3-4(한글 리뷰)와 §3-5(체크포인트 2)가 통째로 빠졌고, 게이트가 초록이라 아무도 몰랐다 — 그래서 G7(리뷰 영수증)이 생겼다.
5. **질문은 조율자만**(D12) — 워커는 `needsDecision`으로 올리고, 묻는 쪽은 조율자다. 형식은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/askquestion-principle.md`. 질문 도구는 `AskUserQuestion` 하나만 쓴다(본문에 물음표를 흘리지 않는다).
6. **리뷰는 격리·1회** — `ko-writing-reviewer`(`docType: 'guide'`), 재리뷰 없음(원칙 3, ② D5).
7. **게이트 먼저** — 빌드는 G1~G7을 통과해야 PDF를 낸다. 낡은 가이드로 만든 PDF는 나가지 않는다.
8. **그림도 검사한다(G6)** — 스크린샷은 DOM을 그린 것이라, 찍는 순간의 글자를 같이 떠 두면 OCR 없이 그림 속 글자를 검사할 수 있다. 이메일·사용자 홈 경로·API 키 모양·사내 표지가 보이면 **막는다** — 공개 자산은 한 번 나가면 회수가 안 된다. 사람이 둔 `manual` 그림과 OS 메뉴·canvas는 기계가 못 본다(사람 몫으로 남긴다 — 잡는 척하지 않는다).
9. **설치는 확인 후** — 대상 프로젝트에 패키지(`@playwright/test`)·브라우저를 넣을 때는 사용자 확인을 받는다(`--unattended`는 사용자가 미리 허용한 경우에만 쓰는 사전 허용이다).

## 명령
```
/dt-guide                     analyze → [체크포인트 1] → capture → write → [체크포인트 2] → build
/dt-guide analyze|capture|write|build   해당 단계만 (앞 단계 산출 파일이 있어야 함)
--type web|electron           타입 강제 (.dt-guide.json 에 기록)
--unattended                  무인 — 질문은 기본값으로 답하고 assumed 표시, 체크포인트는 자동 승인 기록, 설치 사전 허용
```

## 실행 모드
- **dispatched(기본)**: 조율자는 §0·체크포인트·질문·스크립트 실행만. 분석은 `Task`로 `guide-analyst`, 집필은 `guide-author`, 한글 리뷰는 `ko-writing-reviewer`.
- **inline degrade(원칙 4)**: 서브에이전트가 없으면 조율자가 각 에이전트 파일의 「할 일」을 직접 밟고 한 줄 고지한다.

## 절차

### §0. 설정·타입
1. `<projectRoot>/.dt-guide.json`이 없으면 `${CLAUDE_PLUGIN_ROOT}/templates/dt-guide.json.tmpl`로 만든다 — `{{PRODUCT}}`는 `package.json`의 `name`(사람이 읽는 이름이 따로 있으면 질문 ①), `{{TYPE}}`은 `--type` > `electron/` 디렉터리·`electron` 의존 감지 > 질문, `{{PDF_NAME}}`은 ASCII `<Product>-User-Guide.pdf`. `forbiddenMarkers`·`distribution`은 빈 배열로 두고, 사내 표지(사내 주소·코드명)를 아는 경우에만 채울지 묻는다.
2. `docs/guide/`가 있으면 재실행이다: `inventory.md`·`guide.md`·`capture.config.mjs`·수령증 두 개의 유무를 표로 보이고, 있는 것은 `priorInventoryPath`·`priorGuidePath`로 워커에 넘긴다.
3. `.gitignore`에 `.dt-guide/`(스크래치)·`docs/guide/guide.html`(빌드 중간 산출)·`docs/guide/shots/*.txt`(G6 검사 재료)가 없으면 그 줄들을 더한다(바꿀 줄을 보이고 확인 — 무인이면 더한 뒤 기록). `.txt`는 그림의 글자를 뜬 중간물이라 커밋하지 않는다 — 커밋하면 지우려던 값이 저장소에 남는다.
4. **무인 규칙** — 무인이면 §0의 질문은 묻지 않는다 — 타입은 감지값(감지 불가면 `web`, `assumed:타입 미감지`), 제품명은 `package.json name`(`assumed:제품명`), 사내 표지(`forbiddenMarkers`)는 기본값만, `.gitignore` 추가는 하고 기록한다.

### §1. analyze
1. `guide-analyst` dispatch — 입력 `{ projectRoot, config, priorInventoryPath?, unattended }`. 반환은 `{ inventoryPath, needsDecision, surface, writingLint, summary }`.
2. `needsDecision`이 있으면 **한 번에 묶어** `AskUserQuestion`으로 묻는다(항목이 4개를 넘으면 나눈다). 각 항목은 자립적이니 `topic`·`options[].label`·`options[].description`·`evidence`·`reflectsTo`를 그대로 옮긴다.
3. 무인이면 사람 대신 고른다 — **`label` 끝에 `(기본값)`이 붙은 옵션**을 고르는 것이 1순위다. 표시가 없으면 `${CLAUDE_PLUGIN_ROOT}/skills/dt-guide/references/prep-checklist.md`의 「무인 기본값」 열, 그것도 없으면 안전한 쪽으로 — 사외 공개가 애매하면 숨김, 캡처가 애매하면 `manual`, 문서와 코드가 어긋나면 코드. 고른 답에는 `assumed:<사유>` 라벨을 붙인다.
4. 답을 `answers: [{ topic, answer, label }]`로 실어 `guide-analyst`를 다시 dispatch 한다. 돌아온 `needsDecision`이 비면 이 단계는 끝이다.
5. **체크포인트 1** — 인벤토리 표(시나리오·화면·캡처 모드·공개·준비물), `surface` 요약(`type`·`router`·`confidence`·`hints`·`screenCount`·`externalRedirects`), `writingLint`(고친 수·남긴 수), `summary` 한 줄을 보이고 승인받는다. `confidence`가 `fallback`이거나 `router`가 `custom — …`이면 "스크립트가 라우터를 몰라 워커가 코드에서 직접 찾았다"고 밝힌다. 무인이면 "자동 승인(무인)"을 `.dt-guide/progress.md`에 적는다.

### §2. capture
1. Playwright 확인: 대상 프로젝트 cwd에서 `@playwright/test`와 `playwright` **둘 다** 본다 — `node -e "require.resolve('@playwright/test/package.json')"`, 실패하면 `node -e "require.resolve('playwright/package.json')"`. 하나라도 잡히면 있는 것이다. 둘 다 없을 때만 **확인 후** `npm i -D @playwright/test`(패키지 매니저는 lockfile로 고른다) + web이면 `npx playwright install chromium`. 무인이면 설치는 사전 허용된 것으로 보고 그대로 넣되 무엇을 설치했는지 기록한다.
2. 레시피: `node "${CLAUDE_PLUGIN_ROOT}/scripts/guide/capture.mjs" <projectRoot> --scaffold-only` → `docs/guide/capture.config.mjs`. 파일이 이미 있으면 **병합**이다 — 인벤토리에 새로 생긴 `needs`만 TODO 스텁으로 끼워 넣고 사람이 쓴 코드는 그대로 둔다(다시 만들지 않는다). `SCAFFOLD_CANNOT_MERGE`·`SCAFFOLD_WOULD_BREAK`면 종료 코드 2와 `❌ 레시피를 건드리지 않았다` 한 줄이 나온다. 원본은 그대로이니 메시지대로 `states: { … }` 블록을 살리거나 레시피를 옮기고 다시 돌린다.
3. `TODO`가 남은 `states`는 조율자가 **채울 수 있는 만큼** 채운다. 근거는 인벤토리뿐이다 — `capture.needs` 설명, 워커가 찾아 둔 `capture.selector`, `features`·`entry`의 버튼·폼 텍스트. 코드를 새로 뒤져야 할 만큼 모르겠으면 `guide-analyst`에 다시 맡긴다. 끝내 못 채우면 그 상태를 요구하는 화면은 `skipped`가 된다 — 사용자에게 알린다(무인이면 기록).
4. Electron에서 `route`가 `view:`·`window:`로 시작하는 화면은 캡처가 저절로 이동하지 않는다. 그 화면은 `states` 또는 레시피 `screens[id].beforeShot`이 직접 열어야 한다(메뉴 클릭·창 전환).
5. 기동은 타입에 따라 다르다.
   - **web** — 조율자가 `capture.config.mjs`의 `start.command`를 백그라운드로 띄우고 `start.url`이 응답할 때까지 기다린다(기본 90초. 근거 문서는 없는 값이니 느린 프로젝트면 늘린다). 뜨지 않으면 캡처를 건너뛰고 이유를 적는다 — write·build는 계속한다(그림 없는 가이드도 가이드다). 기동 로그에 `ERR_MODULE_NOT_FOUND`·`Cannot find package`가 보이면 의존성이 설치되지 않은 것이다 — 사용자에게 `pnpm install`(lockfile 기준 패키지 매니저)을 제안하고, 무인이면 설치 후 한 번 다시 띄운다(기록).
   - **electron** — 앱은 캡처 드라이버가 `start.mainEntry`로 직접 띄운다(임시 `--user-data-dir`로 격리). 조율자는 앱을 띄우지 않는다 — 따로 띄우면 격리된 인스턴스와 둘이 다툰다.
6. 실행: `node "${CLAUDE_PLUGIN_ROOT}/scripts/guide/capture.mjs" <projectRoot>` → 결과 표 `[SCR-id | mode | 결과 | 사유]`를 보인다. 종료 코드 0은 전부 성공, 1이면 `failed`가 있거나 인벤토리를 못 읽은 것 — 결과 표가 비었으면 캡처가 안 돈 것이니 계속하지 말고 원인을 보인다(표가 차 있으면 일부 실패이니 그대로 계속). 2는 실행 오류(Playwright 없음 따위) — 2면 캡처 없이 다음 단계로 넘어간다. 실행 중 `⚠ … 자동 이동 없음` 줄이 뜨면 그 화면의 `states`·`screens[id].beforeShot`을 채우고 다시 돌린다.
7. web이면 §2-5에서 띄운 서버를 내린다(electron은 드라이버가 앱을 닫으니 조율자가 내릴 것이 없다). 수령증 `docs/guide/shots/capture-receipt.json` 경로를 §3에 넘긴다.
8. **`manual` 그림 확인** — `capture.mode: manual`인 화면마다 `docs/guide/shots/manual/<SCR-id>.png`가 있는지 본다. 없으면 — 유인: 사용자에게 그림을 두게 안내하고 기다린다(§3으로 넘어가면 G3가 막는다). 무인: 「실패·폴백」의 무인 규칙대로 그 화면을 이번 판 `none`(`assumed`)으로 바꾸고 가정 목록에 올린다.

### §3. write
1. `guide-author` dispatch — 입력 `{ projectRoot, config, inventoryPath, captureReceiptPath?, priorGuidePath? }`. 반환은 `{ draftPath, coverage, gate, writingLint, sections, summary }`.
2. 워커는 `--gate-only`를 스스로 3회까지 돌린다. 그래도 `gate.ok`가 false면 `gate.findings`를 입력 `gateFindings`에 그대로 실어 **한 번만** 다시 dispatch 하고, 남는 findings는 체크포인트 2에서 사용자에게 보인다.
3. `guide-author`는 질문하지 않는다 — 사람이 정해야 할 것은 `coverage.missing`(인벤토리에 있는데 가이드에 못 담은 항목)과 `summary`로 올라온다. 조율자가 체크포인트 2에서 함께 보인다. 인벤토리 자체를 고쳐야 하면 `/dt-guide analyze`부터 다시 돈다(워커는 인벤토리를 고치지 않는다).
4. **한글 리뷰(격리·1회)** — `ko-writing-reviewer` dispatch `{ path: '<projectRoot>/docs/guide/guide.md', docType: 'guide' }`. 반환 `{ verdict, findings, changeRatio, lintTotal, lintFalsePositive }`. `NEEDS_REPAIR`면 각 finding의 `after`를 `line`의 그 문장에 그대로 끼운다. `after`가 비었거나 `needsHuman: true`인 항목은 손대지 않고 "확인 요망"으로 모은다. 표 [행 | 규칙 | 전 | 후 | 이유]와 확인 요망 목록, `changeRatio` 한 줄을 보인다. **재리뷰 없음.**

   **끝나면 영수증을 남긴다** — `docs/guide/ko-review.json` 에 `{ verdict, at, bodyHash }`. `bodyHash` 는 **고친 뒤의** `guide.md` 본문(front matter 제외) sha256 이다(`koReviewHash`). G7 이 이 파일을 보고, 없거나 해시가 어긋나면(= 리뷰 뒤에 글을 고쳤으면) 빌드를 막는다. 리뷰를 건너뛰면 여기서 걸린다.
5. **체크포인트 2** — 초안 전체(길면 `sections` 목록 + 그림 수), 위 표, 집필 워커의 `writingLint`(고친 수·남은 수 — 집필 워커의 `remaining`은 리뷰어에게 넘어갈 양이다. analyst의 `kept`와 다른 뜻)를 리뷰어 표와 나란히, `coverage.missing`, 남은 게이트 findings를 함께 보이고 승인받는다. 무인이면 자동 승인으로 적는다.

### §4. build
1. `node "${CLAUDE_PLUGIN_ROOT}/scripts/guide/build.mjs" <projectRoot> --shots-refreshed` — `--shots-refreshed`는 이번 실행에서 §2를 실제로 돌렸을 때만 붙인다. 종료 코드 0은 통과. 1이면 출력이 `❌ 가이드 게이트 실패 N건`인지 먼저 본다 — 아니면 렌더·입출력 오류 한 줄이다. 2는 사용법·경로 오류. 점검만 할 때 쓰는 `--no-pdf`로는 배포용 PDF가 나오지 않는다 — 그렇게 만든 영수증은 릴리스 점검에서 거부된다.
2. 게이트가 막으면 findings를 그대로 보이고 멈춘다 — G1은 `guide.md`의 `version`을 `package.json`에 맞추라고(인벤토리 `version`은 참고용이라 G1이 보지 않는다), G2는 어느 id가 빠졌거나 남았는지, G3는 어느 그림이 없는지, G5는 몇 행의 무엇인지, G6는 어느 화면 그림에 무엇이 보이는지, G7은 한글 리뷰가 지금 글을 봤는지 짚어 준다. G7이 막으면 §3-4 를 다시 돌리고 `docs/guide/ko-review.json` 을 새로 남긴다 — 본문을 손댔으면 리뷰도 다시 받아야 한다. G6가 막으면 그 화면의 `capture.config.mjs` `screens[id].redact`에 `{ selector, text }`를 적어 가리고 `/dt-guide capture`부터 다시 돈다 — 제품이 일부러 보여 주는 예시 값이면 `.dt-guide.json`의 `allowInShots`에 적어 통과시킨다(그냥 통과와 적어서 통과는 다르다). G3가 `manual` 화면의 그림 부재면 사용자가 `docs/guide/shots/manual/<SCR-id>.png`를 두고 다시 빌드한다. G0은 설정·front matter·`guide.md`/`inventory.md` 부재 — `/dt-guide write`(또는 analyze)부터 다시.
3. **G4(MINOR가 올랐다)는 조율자 몫이다** — 그림이 아직 맞는지 사용자에게 확인받은 뒤(무인이면 이번 실행의 캡처 수령증이 이번 판인지 확인한 뒤) `guide.md` front matter의 `manualShotsReviewedAt`을 지금 `version`으로 올리고 다시 빌드한다. 그림이 낡았으면 값을 올리지 말고 `/dt-guide capture`부터 다시 돈다.
4. 통과하면 `docs/guide/<pdfName>`·`docs/guide/guide-receipt.json` 경로를 보인다. 빌드는 `/dt-guide build`로 한다. 프로젝트 `package.json`에는 스크립트를 넣지 않는다(플러그인 경로에 의존한다).
5. **가정 목록** — 이번 실행에서 `assumed` 라벨이 붙은 항목을 표 [항목 | 고른 값 | 사유]로 모아 보인다("바꿀 것만 말해 달라 — 바꾸면 `/dt-guide analyze`부터 다시 돈다").
6. **커밋은 사용자 몫이다** — 무엇을 커밋할지 목록으로 보인다: `docs/guide/**`(인벤토리·레시피·그림·`guide.md`·PDF·영수증), `.dt-guide.json`, 바뀐 `.gitignore`, 바뀐 `package.json`. 스크래치 `.dt-guide/`와 빌드 중간 산출 `docs/guide/guide.html`은 커밋 대상이 아니다.

## 실패·폴백
- `surfaceInventory`가 `unknown`·`none`을 내도 멈추지 않는다(워커가 코드에서 찾는다). 워커가 화면을 하나도 못 찾으면 `needsDecision`으로 올라오고, 조율자가 화면 목록을 묻는다.
- Playwright를 넣을 수 없으면 캡처 없이 간다. G3는 `capture.mode: auto`인데 shot이 없으면 막으므로, 남은 화면마다 `capture.mode`를 `none`(reason "캡처 환경 없음")으로 바꾸고 `assumed`를 붙인 뒤 §3으로 넘어간다.
- **무인 실행에서 `manual` 그림이 없으면**(§2-8에서 확인한다) 그 화면의 `capture.mode`를 이번 판만 `none`(reason "사람이 찍은 그림이 없어 글로만 안내 — 그림이 준비되면 manual로 되돌린다")으로 바꾸고 `assumed`를 붙인다. 가정 목록에 올린다.
- 레시피 병합이 막히면(§2-2) 레시피는 한 글자도 바뀌지 않은 상태다 — 사용자에게 원문을 살릴 방법 두 가지(블록 복원, 파일 이동 후 재생성)를 보이고 고르게 한다.
- 서브에이전트를 못 쓰면 inline degrade + 한 줄 고지.

## 관련
`dt-spec-collect-project-context`(스택 분류 표 재사용) · `dt-audit`(`surfaceInventory.mjs` 공유) · `dt-worklog-sync`·`dt-confluence-doc`(같은 `ko-writing-reviewer`) · 후속: Confluence 얇은 안내(스펙 §10).
