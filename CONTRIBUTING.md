# 기여 가이드

이 플러그인에 스킬·리뷰 규칙·에이전트·명령을 더하거나 고치는 법을 적는다. **이 문서만 보고 리뷰 규칙 하나를 추가할 수 있어야 한다** — 그게 안 되면 이 문서가 틀린 것이니 고친다.

먼저 읽을 것: [호환 정책](docs/refs/compat-policy.md)(버전과 산출물 형식) · [공용 정책](docs/orchestration-policy.md)(스킬·에이전트가 주고받는 형식) · [쉬운 글쓰기](docs/refs/readable-writing.md)(한글 본문).

## 1. 어디에 무엇을 두나

| 폴더 | 무엇 | 누가 읽나 |
|---|---|---|
| `skills/<이름>/SKILL.md` | 스킬 — 절차와 판단 기준 | 모델(명령이 부르거나 스스로 발동) |
| `skills/<이름>/references/` | **그 스킬만** 쓰는 긴 참조(본문 견본·세부 절차) | 그 스킬 |
| `skills/<이름>/patterns/` | 리뷰 규칙(architecture·testing 스킬만) | 리뷰 엔진 + 사람 |
| `skills/<이름>/scripts/` · `tests/` | 그 스킬만 쓰는 스크립트와 테스트 | 그 스킬 |
| `docs/refs/` | **여러 스킬이 함께 쓰는 원본** — 같은 규칙을 두 곳에 적지 않는다 | 여러 스킬·에이전트 |
| `docs/orchestration-policy.md` | 스킬↔에이전트 공용 규약(원칙 1~10) | 모든 조율 스킬·에이전트 |
| `docs/specs/` | 설계 이력(날짜가 붙은 문서). **런타임에 읽지 않는다** | 사람 |
| `agents/<이름>.md` | 에이전트 — 조율 스킬이 일을 맡기는 워커·판정자 | 조율 스킬 |
| `commands/<이름>.md` | 명령 — 사용자가 `/`로 부르는 입구. 인자만 받고 스킬을 가리킨다 | 사용자 |
| `rules/vendored/` | 외부에서 들여온 규칙(출처를 `SOURCE.md`에) | 리뷰 엔진 |
| `templates/` · `templates-backend/` | 산출물·설정 템플릿 | 스킬 |
| `scripts/` · `scripts/lib/` | 여러 스킬이 쓰는 결정적 도구(Node, 의존성 없음) | 스킬·테스트 |
| `scripts/review/` · `tests/review/` | FE·BE 공용 리뷰 엔진과 그 테스트([리뷰 엔진](docs/refs/review-engine.md)). 검출기는 `lib/detection/<type>.mjs`. 규칙 경로는 표준 `src/…`로 적는다 — 프로젝트 구조는 엔진이 바꿔 끼운다([스택 설정](docs/refs/stack-config.md)) | 리뷰 스킬·`reviewer`·스캐폴드 게이트 |

**`docs/refs/`냐 `references/`냐:** 두 스킬 이상이 읽으면 `docs/refs/`, 한 스킬만 읽으면 그 스킬의 `references/`. 구조 테스트가 원본 문장이 다른 곳에 다시 적혔는지 잡는다.

## 2. 이름·언어

- 스킬·명령은 `dt-` 접두어 + kebab-case. **스킬 `name` = 폴더 이름, 에이전트 `name` = 파일 이름.** 리뷰 규칙 `ruleId` = 파일 이름(확장자 뺀 것).
- **머리말 `description`은 영어 발동 문구**("Use when …")가 기본이다 — 모델이 언제 부를지 판단하는 데 쓴다. 명령의 `description`은 사용자가 읽으니 한국어로 써도 된다.
- **본문은 한국어.** 사용자에게 보이거나 산출물에 들어가는 문장은 [쉬운 글쓰기](docs/refs/readable-writing.md)를 따르고 `node scripts/koWritingLint.mjs <파일>`로 점검한다.
- **스크립트가 읽는 산출물 제목·상태 라벨은 [`scripts/lib/headings.mjs`](scripts/lib/headings.mjs) 한곳에 둔다.** 템플릿의 `## 제목`이나 정의서 상태 라벨(확정·컨벤션·협의중·미해소)을 바꾸면 레지스트리도 같이 고친다. 스크립트에 제목 문자열을 새로 적지 않는다 — 둘이 어긋나면 `tests/headings.test.mjs`가 잡는다.
- "필요시·적절히·적당히" 같은 조건 없는 표현을 쓰지 않는다 — "언제"를 조건으로 적는다(구조 테스트가 잡는다).
- 공개 저장소다. 회사·고객사 이름, 사내 주소, 개인 이메일, cloudId를 넣지 않는다(`npm run scan`).

## 3. 머리말 형식

**스킬** (`skills/<이름>/SKILL.md`)
```yaml
---
name: dt-example                # 폴더 이름과 같다
description: Use when … — 언제 발동하는지와 무엇을 하는지, 영어 한두 문장
user-invocable: false           # 같은 이름 명령이 있으면 필수(진입점은 명령 하나)
---
```
- 본문 300줄 이하(구조 테스트). 길면 `references/`나 `docs/refs/`로 나눈다.
- 막히는 자리는 그만두지 않고 선택지를 준다(원칙 10). 정말 멈춰야 하면 `<!-- hard-stop: 이유 -->`.

**에이전트** (`agents/<이름>.md`)
```yaml
---
name: example-author
model: opus                     # opus | sonnet | haiku — 티어는 scripts/lib/config.mjs AGENT_TIERS
description: 무엇을 하는 워커인지 · 사용자 호출 불가(agents/ — <조율 스킬>이 dispatch)
tools: Read, Grep, Glob, Bash   # 판정형(리뷰어)은 Write·Edit 를 빼고 허용 목록을 적는다
---
```
- 작업형은 `{ status, artifacts, needsDecision, summary }`, 판정형은 `{ verdict, findings, summary }`를 돌려준다(원칙 5). 사용자에게 직접 묻지 않는다 — `needsDecision`으로 올린다.
- 쓰는 파일은 `docs/refs/artifact-contract.md` 표에 한 줄로 올린다(같은 파일·절의 쓰는 쪽은 하나).
- `AGENT_TIERS`에 넣고 README 전체 목록을 다시 만든다(§6).

**명령** (`commands/<이름>.md`)
```yaml
---
description: 사용자가 읽는 한 줄 설명
argument-hint: '[인자 …]'
allowed-tools: Read, Bash, AskUserQuestion   # 스킬 절차에 필요한 도구. Atlassian 도구는 docs/refs/atlassian-mcp.md §3
---
```
- 40줄 이하, `## 인자`와 `## 동작`(어느 스킬을 따르는지)만. **절차(흐름·순서·단계)는 스킬에 둔다**(구조 테스트).

## 4. 리뷰 규칙 하나 추가 — 따라 하기

예: "FE 페이지 컴포넌트에서 `console.log`를 쓰지 않는다".

1. **스택과 묶음을 고른다.** FE 구조 규칙이면 `skills/dt-frontend-architecture/patterns/`, FE 테스트 규칙이면 `skills/dt-frontend-testing/patterns/`. BE는 `dt-backend-*`.
2. **파일을 만든다.** 이름 = ruleId: `skills/dt-frontend-architecture/patterns/no-console-in-pages.md`
   ~~~markdown
   ---
   ruleId: no-console-in-pages
   summary: "페이지 컴포넌트에서 console.log 를 남기지 않는다 — 디버그 출력은 지우거나 로거로"
   severity: minor
   appliesTo: ["src/pages/**/*.{ts,tsx}"]
   detection:
     - type: forbidden-pattern
       pattern: "console[.]log[(]"
       rationale: "배포 빌드에 디버그 출력이 남는다"
   relatedRules: []
   ---

   # 페이지에 console.log 를 남기지 않는다

   ## 왜 중요한가
   배포 빌드 콘솔에 내부 상태가 그대로 찍힌다.

   ## ❌ Incorrect
   ```tsx
   console.log(user);
   ```

   ## ✅ Correct
   ```tsx
   // 지운다. 남겨야 하면 로거를 쓴다.
   ```
   ~~~
   - **머리말 규칙**은 [rule-frontmatter.schema.json](docs/refs/rule-frontmatter.schema.json)이 원본이다. 필수: `ruleId`·`summary`·`severity`(`critical`·`important`·`minor`)·`appliesTo`·`detection`.
   - **검출 type**과 type별 필수 인자:

     | type | 필수 | 하는 일 |
     |---|---|---|
     | `forbidden-import` | `matches` | import 경로 금지 |
     | `forbidden-call` | `matches` | 함수 호출 금지(`matchArguments`로 인자 조건) |
     | `forbidden-pattern` | `pattern` | 정규식 금지(`flags`, 기본 `g`) |
     | `pattern-pair` | `when` | `when`이 있으면 `require`/`requireAll`이 있어야 하고 `forbid`는 없어야 함 |
     | `jsx-tag-attrs` | `tags`·`requireAll` | JSX 태그에 속성 강제 |
     | `requires-sibling-test` | — | 같은 위치에 테스트 파일(`testPath`) |
     | `requires-acceptance-ledger` | — | 수용 e2e 원장 |
     | `registered-in-sibling-module` | — | NestJS 모듈 등록 |
     | `required-pattern` | `description` | 설명 문구로 정해진 검사만, 나머지는 수동 확인 |
     | `ast-rule` · `manual` | `description` | 기계 검출 없음 — 보고서의 "수동 확인" |

   - **기계로 못 잡으면 `type: manual`로 정직하게 적는다.** 필수 인자 없이 type만 적으면 검출기가 빈 결과를 내 "검사하는 척"한다 — 검사기가 막는다.
   - 정규식에 `\`가 필요하면 `[.]`·`[(]`·`[ \t]` 같은 문자 묶음을 먼저 쓴다(머리말 파서가 따옴표 안 문자를 그대로 넘긴다).
3. **스킬의 규칙 목록에 한 줄 더한다** — 같은 스킬 `SKILL.md`의 규칙 목록에, 머리말과 **글자까지 같게**:
   `- **no-console-in-pages** _(minor)_ — 페이지 컴포넌트에서 console.log 를 남기지 않는다 — 디버그 출력은 지우거나 로거로 [상세](patterns/no-console-in-pages.md)`
4. **검사한다.**
   ```bash
   node scripts/validateRules.mjs                     # 머리말·검출 인자·relatedRules
   node scripts/review/review.mjs partial --paths src/pages/Home.tsx --project <위반 예제가 있는 프로젝트>
   npm test                                           # 규칙 목록 = 머리말, 엔진 테스트
   ```
   위반 예제에서 그 ruleId가 나오고, 고친 예제에서는 안 나와야 한다.
5. **끌 수 있는 규칙이면** `overridable: true`·`overrideKey: <키>` — 스택 설정 `overrides.<키>`로 끄되 근거 결정(`decisionRef`, `/dt-decision`)이 있어야 한다.
6. `CHANGELOG.md` 미출시 절 "추가"에 한 줄.

## 5. 스킬·에이전트 하나 추가

1. 폴더·파일과 머리말(§3). 여러 스킬이 쓸 규칙이면 `docs/refs/`에 원본을 두고 가리킨다.
2. 조율 스킬이면 원칙 1~10을 따른다 — 실행 모드(병렬/순차), 에이전트 dispatch, needsDecision 묶음 질문, 막혔을 때 선택지.
3. 산출물을 쓰면 `docs/refs/artifact-contract.md`에 경로·쓰는 쪽을 올리고, 새 산출물 종류면 `scripts/artifactSchemas.mjs`에 형식 버전을 등록한다(호환 정책 §5).
4. 사용자가 부르는 것이면 `commands/<이름>.md`를 만들고 스킬에 `user-invocable: false`.
5. README 전체 목록을 다시 만든다(§6). 스킬·에이전트·명령 개수 줄도 맞춘다.

## 6. 올리기 전에

```bash
DT_FORBIDDEN_RULES=<조직 금칙어 JSON> npm test   # 전체 테스트(구조 테스트 포함)
npm run scan                                      # 금칙어
node scripts/validateRules.mjs                    # 리뷰 규칙 머리말
node scripts/readmeCatalog.mjs --write            # README 전체 목록(머리말에서 자동 생성 — 손으로 고치지 않는다)
```

- [ ] `CHANGELOG.md` 미출시 절에 적었다. 사용자 프로젝트 파일 형식이 바뀌면 **산출물 형식 변경** 절과 이전 방법(`/dt-migrate`)
- [ ] 같은 규칙을 두 곳에 적지 않았다(원본 하나)
- [ ] 스킬 300줄·명령 40줄 이하
- [ ] 버전은 릴리즈할 때만 `node scripts/release.mjs <patch|minor|major> --write`로 올린다(4곳 + CHANGELOG). 커밋·태그는 확인 뒤
