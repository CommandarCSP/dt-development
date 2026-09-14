---
name: dt-ko
description: Use when the user wants Korean prose checked or cleaned up — "한국어 좀 봐줘", "문장 다듬어줘", "표현 이상한 데 없나", "/dt-ko". Runs koWritingLint (mechanical) plus one isolated ko-writing-reviewer pass over the given files (or the git diff), shows before/after, and applies only what the user approves. Works on any Korean markdown — README·CHANGELOG·배포 문서·스펙·UI 문구.
---

# dt-ko — 한국어 문장 검사 (사용자 호출)

> 규칙 SOT: `${CLAUDE_PLUGIN_ROOT}/docs/refs/readable-writing.md` (A·B·C 묶음).
> 조각: `${CLAUDE_PLUGIN_ROOT}/scripts/koWritingLint.mjs`(기계) · `ko-writing-reviewer` 워커(문장).

## 왜 있는가

한글 리뷰는 이미 `dt-worklog-sync`·`dt-confluence-doc`·`dt-explain`·`dt-guide` 안에 들어 있다.
다만 그 넷은 **자기 산출물에만** 붙는다 — Jira 로 나가는 글, Confluence 로 나가는 글, 가이드 PDF.
정작 저장소에 남는 글(README·CHANGELOG·배포 문서·스펙·앱 UI 문구)은 아무도 보지 않았고,
사람이 "이 문서 한국어 좀 봐줘" 라고 부를 데도 없었다. 이 스킬이 그 자리다.

## 불변 원칙

1. **원문을 말없이 고치지 않는다** — 표로 보이고 승인받은 것만 적용한다(`--fix` 는 사용자가 미리 허용한 경우).
2. **리뷰는 격리·1회** — `ko-writing-reviewer` 에 맡기고 재리뷰를 요구하지 않는다(원칙 3, D5).
3. **막지 않는다** — 이건 게이트가 아니라 부르면 도와주는 도구다. 산출물이 정해진 파이프라인의 강제(`/dt-guide` 의 G7)와는 성격이 다르다.
4. **보존 원칙** — 고유명사·수치·코드 식별자·파일 경로·인용은 한 글자도 바꾸지 않는다. 주장 강도와 격식체를 유지한다.
5. **맞춤법·띄어쓰기는 안 본다** — 비목표다(`ko-writing-reviewer` 의 「안 하는 것」).

## 명령

```
/dt-ko                    git 변경분(staged + unstaged) 중 한글 .md
/dt-ko <파일…>            지정한 파일
/dt-ko --docType <type>   판정을 강제 (jira|confluence|guide|explain|spec)
/dt-ko --fix              표를 보인 뒤 승인 없이 적용 (사용자가 미리 허용했을 때만)
```

## 절차

### §1. 대상 고르기
1. 인자에 파일이 있으면 그것. 없으면 `git diff --name-only HEAD` + `git diff --cached --name-only` 의 합집합에서 `.md` 만 고른다.
2. 한 건도 없으면 "검사할 한글 문서가 없다" 한 줄로 끝낸다 — 빈 표를 만들지 않는다.
3. 20개를 넘으면 목록을 보이고 어디까지 볼지 묻는다(`AskUserQuestion`). 한 번에 다 돌리면 표가 읽히지 않는다.

### §2. docType 판정
경로로 고른다. `--docType` 이 있으면 그것이 이긴다.

| 경로 | docType | 왜 |
|---|---|---|
| `docs/guide/**` | `guide` | 사외 독자 — 2인칭·개발 용어·사내 표지를 더 본다 |
| `docs/specs/**` · `docs/**/plans/**` | `spec` | EARS 줄·요소 목록을 검사에서 뺀다 |
| 그 밖의 `.md` | `confluence` | 사내 문서 기준 |

판정한 값을 파일마다 한 줄로 보인다 — 틀렸으면 사용자가 그 자리에서 `--docType` 으로 덮어쓴다.

### §3. 기계 검사
`node "${CLAUDE_PLUGIN_ROOT}/scripts/koWritingLint.mjs" <파일> --json --docType <type>`.
종료 코드 0·1 은 정상(0=findings 없음), **2 는 파일·사용법 오류** — 그 파일은 건너뛰고 이유를 적는다.

### §4. 문장 리뷰 (격리·1회)
`ko-writing-reviewer` dispatch `{ path, docType }`. 반환은
`{ verdict, findings, changeRatio, lintTotal, lintFalsePositive }`.

서브에이전트를 쓸 수 없으면 **inline degrade** — 조율자가 `${CLAUDE_PLUGIN_ROOT}/agents/ko-writing-reviewer.md`
의 「할 일」을 직접 밟고 그 사실을 한 줄 고지한다(원칙 4).

### §5. 보이고 승인
파일마다 표 하나.

```
docs/배포.md — confluence · lint 3건(오탐 1) · 바뀐 문장 4/126 (0.03)

행    규칙   전                          후                          이유
150   C3     그 엔진이 제공하는          그 엔진에서 쓸 수 있는       제공하다 → 사외 문서에는 일상어
170   C3     호출 요금이 발생합니다      호출 요금이 듭니다           발생하다 → 생기다·들다
```

- `after` 가 비었거나 `needsHuman: true` 인 항목은 **적용하지 않고** "확인 요망" 으로 따로 모은다.
- `changeRatio` 가 0.5 를 넘는 문단이 있으면 과교정 가드가 걸린 것이다 — 그 문단은 사람이 본다.
- 오탐으로 버린 lint findings 수를 함께 보인다. 기계가 뭘 잘못 짚었는지가 다음 판의 재료다.

### §6. 적용
승인한 항목만 `before` → `after` 로 **그 문장만** 바꾼다. 앞뒤 문장을 재배치하지 않는다.
적용한 뒤 lint 를 한 번 더 돌려 남은 findings 수를 보인다(재리뷰가 아니라 확인이다).

## 흔한 오탐 — 버릴 것

`ko-writing-reviewer` 와 같은 목록이다. 걸리면 판정 기준("동료에게 말로 설명할 때 쓰겠는가")을 대 본다.

- `네트워크를 통해 전송` — `~을 통해` 가 실제 경로일 때
- `재설정은…` — `설정` 이 더 긴 낱말 안에서 잡힐 때
- `그 자리에서 취소` · `백그라운드에서 돌아갑니다` — 관용구(readable-writing 「관용구로 굳은 것」)
- 소프트웨어가 안내를 띄우는 것을 `알려 줍니다`·`보여 줍니다` 로 부르는 것

## 안 하는 것

- 파이프라인 강제(게이트) — `/dt-guide` 의 G7 이 그 역할이고, 이 스킬은 부를 때만 돈다.
- 맞춤법·띄어쓰기 교정 · 문체 변환(정중체↔평서체) · 재리뷰
- 코드 주석·커밋 메시지 — 대상이 아니다(사용자가 파일로 지정하면 그때는 본다).
