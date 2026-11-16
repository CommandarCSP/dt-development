# dt-spec 소스 입력 — [0] Pre-flight · [1] 입력 수집 · [1-재실행]

> `dt-spec-generate-spec` 절차의 앞부분(FE 전용). 조율자·`spec-author`가 [0]~[1-재실행]에서 이 문서를 그대로 따른다. 설계: `docs/specs/2026-06-01-dt-spec-multi-source-design.md`.

## [0] Pre-flight Check — CONDITIONAL (Figma 소스가 있을 때만)

**Figma 소스가 1개도 없으면 이 단계를 완전히 건너뛴다.** 문서 전용 실행(markdown/pdf/web만 입력)에서는 Figma MCP 체크가 필요 없다.

Figma 소스가 1개 이상이면 순서대로 확인:

1. Figma MCP 서버 연결 확인
   - 시도: `mcp__plugin_figma_figma__get_metadata("1:1")` (임시 호출)
   - 실패 → "Figma MCP가 연결되지 않았습니다. `/mcp`로 연결 상태를 확인해주세요." → AskUserQuestion(원칙 10): "연결·권한을 고치고 다시 시도" / "Figma 없이 나머지 소스로 진행"(`status: draft`, layout-skeleton은 구조 스켈레톤·스텁, 헤더에 `(load-failed)`) / "중단". 다른 소스가 없으면 두 번째 선택지 대신 "문서 소스를 지금 추가"를 낸다.
2. Figma 액세스 토큰 확인 (MCP 서버가 인증 에러 반환 시) → 안내 → AskUserQuestion(원칙 10): "연결·권한을 고치고 다시 시도" / "Figma 없이 나머지 소스로 진행"(`status: draft`, layout-skeleton은 구조 스켈레톤·스텁, 헤더에 `(load-failed)`) / "중단". 다른 소스가 없으면 두 번째 선택지 대신 "문서 소스를 지금 추가"를 낸다.
3. 파일 접근 권한 확인 (위 호출이 401/403 반환 시) → "Figma 파일 공유 권한을 확인해주세요" → AskUserQuestion(원칙 10): "연결·권한을 고치고 다시 시도" / "Figma 없이 나머지 소스로 진행"(`status: draft`, layout-skeleton은 구조 스켈레톤·스텁, 헤더에 `(load-failed)`) / "중단". 다른 소스가 없으면 두 번째 선택지 대신 "문서 소스를 지금 추가"를 낸다.
4. 각 figma@design 소스의 nodeId 조회 가능:
   - `mcp__plugin_figma_figma__get_metadata(nodeId)` → 실패 시 AskUserQuestion(원칙 10): "올바른 node id를 입력"(Other로 입력받아 다시 조회) / "이 노드 없이 나머지 소스로 진행"(`status: draft`) / "중단".
5. 각 figma@wireframe 소스의 nodeId 조회 가능 → 동일 검사.
6. `designSystemNodeId` (있다면) 조회 가능 → 실패 시 경고만 + 계속 (사용자 confirm).

## [1] 입력 수집 + 소스 해석 (dt-spec 설계 §4)

### 소스 파싱 + 타입 자동감지

`scripts/parseSources.mjs`를 호출해 positional 인자와 `--source` 플래그를 `ResolvedSource[]`로 변환한다.

타입 자동감지 우선순위 (위에서 아래, 첫 매칭):

| 순위 | 패턴 | 타입 |
|---|---|---|
| 1 | `--source type:...` 또는 locator prefix 명시 | (명시값) |
| 2 | `figma.com/...` URL | `figma` |
| 3 | 확장자 `.md` `.markdown` `.txt` | `markdown` |
| 4 | 확장자 `.pdf` | `pdf` |
| 5 | `notion.so/...` `*.atlassian.net/...` | `web` |
| 6 | 기타 `http(s)://...` | `web` |
| 7 | `^\d+:\d+$` (순수 노드 id) | `figma` |

자동감지 실패 → AskUserQuestion(원칙 10): "소스 타입을 알 수 없습니다: `<locator>`" — 선택지 "figma 노드로 본다" / "문서(.md/.pdf)로 본다" / "웹 링크로 본다" / "이 소스를 빼고 진행". 고른 타입으로 `--source <type>@<role>:<locator>`처럼 다시 해석한다.
소스 0개 (positional·--source 모두 없음) → 그만두지 않고 소스를 받는다(원칙 10): "어떤 화면의 스펙을 만들까요? Figma 노드 URL·.md/.pdf 경로·웹 링크를 넣어 주세요"(Other 입력, 예시 포함). 받은 값으로 위 자동감지를 다시 돈다.

### 소스별 콘텐츠 로드

각 타입에 맞게 콘텐츠를 로드한다:

- **markdown**: `Read` 도구로 파일 읽기.
- **pdf**: `Read` 도구로 읽기 (`pages` 파라미터로 멀티페이지 추출).
- **web (Notion)**: `notion-fetch` MCP 도구 사용.
- **web (Atlassian/Confluence)**: 하는 일 `confluence.get`(URL로 페이지 읽기). 실제 도구 이름·인자(v1·v2가 다르다)와 접두어는 `${CLAUDE_PLUGIN_ROOT}/docs/refs/atlassian-mcp.md`에서 찾는다. 본문이 필요하므로 마크다운 전문으로 읽는다.
- **web (일반 URL)**: `WebFetch` 도구 사용.
- **figma**: 노드 참조만 보관 (실제 로드는 AnalyzeFigmaFrame 어댑터가 MCP로 수행).

### Figma 역할(@role) 처리

| 입력 | 처리 |
|---|---|
| Figma 노드, `@role` 명시 (`235:1412@design`) | 명시값 사용, 질문 안 함 |
| Figma 노드, 역할 미지정 | **항상 AskUserQuestion으로 확인** (dt-spec 설계 §2 결정 9) |
| 문서 소스 (md/pdf/web) | 역할 불필요 — 질문 안 함 |

역할 미지정 Figma 노드가 있을 때 AskUserQuestion 예:
- `header`: "Figma 노드 역할 지정"
- `question`: "다음 Figma 노드들의 역할을 지정해주세요. 역할에 따라 어떤 어댑터로 분석할지 결정됩니다 — design은 화면 레이아웃·컴포넌트·디자인 토큰 추출, wireframe은 흐름·시나리오·비즈니스 규칙 추출에 쓰입니다. 잘못 지정하면 해당 산출물(requirements.md/design.md/layout-skeleton.md)에 빠진 정보가 생깁니다. 노드 목록: [nodeId-1], [nodeId-2]. 추천: 첫 번째=design, 두 번째=wireframe."
- options: label `"첫 번째=design, 두 번째=wireframe (추천)"`(description `"[nodeId-1]을 UI 시각 추출(design)로, [nodeId-2]를 흐름·규칙 추출(wireframe)로 사용"`) / label `"반대로 지정"`(description `"[nodeId-1]=wireframe, [nodeId-2]=design"`) / label `"직접 지정"`(description `"각 노드의 역할을 직접 입력"`)

### 카디널리티 검증

design 최대 1개, wireframe 최대 1개. 위반 시 에러:
- design 2개 → "Figma 디자인 노드는 1개만 지원합니다. 한 화면이 여러 프레임으로 나뉘어 있으면 **그 프레임들을 감싸는 상위 프레임 노드 id**를 주세요(상위 노드로 우회)." → AskUserQuestion(원칙 10)으로 둘 중 어느 노드를 design으로 쓸지 묻는다(선택지: 노드 A / 노드 B / "감싸는 상위 노드 id를 입력"). 고르지 않은 노드는 버린다.

### 부분 로드 실패 처리 (dt-spec 설계 §4-5)

단일 소스 로드 실패(파일 없음 / fetch 401 / MCP 미연결):
- 해당 소스 보고 + AskUserQuestion: `header` "소스 로드 실패", `question` "[소스 locator] 로드에 실패했습니다(이유: <에러>). 나머지 소스로만 계속 진행할까요? 계속 선택 시 이 소스가 빠진 상태로 스펙이 생성되며 `status: draft`로 저장됩니다. 빠진 소스가 design 노드라면 layout-skeleton.md가 구조 스켈레톤 또는 스텁이 됩니다.", options: label `"나머지 소스로 계속"`(description `"실패 소스를 제외하고 진행. 산출물 헤더에 (load-failed) 노트로 표시, status: draft 강제"`) / label `"중단"`(description `"소스를 수정한 후 다시 실행")`.
- **계속 선택 시**: `status: draft` 강제 + 해당 소스에 `loadFailed: true` 마킹 (헤더 sources에 `(load-failed)` 노트로 기록).
- **전체 소스 로드 실패** (유효 소스 0개) → "모든 소스 로드에 실패했습니다" + AskUserQuestion(원칙 10): "원인을 고치고 다시 시도" / "다른 소스를 지금 입력" / "중단". 산출물은 만들지 않는다.

### figmaFileKey 파생

Figma URL(`figma.com/design/:fileKey/...`)이 있으면 fileKey를 파싱한다. fileKey는 `AnalyzeFigmaFrame` 호출 인자로 전파하고, **산출물 헤더 `sources` 줄에 `figmaFileKey`와 design nodeId를 함께 기록한다** — 구현/충실도 검증 단계가 에셋을 재조회(asset URL 만료 시)하고 디자인과 대조할 수 있도록. (이전엔 미기록이었으나, 에셋·테마 충실도를 위해 fileKey를 durable하게 남긴다.)

예 (page 이름 확정):
- `header`: "페이지 이름"
- `question`: "산출물이 저장될 디렉토리명을 정합니다. Figma 페이지 노드명에서 'SCR_FLE_01'을 추출했는데, `docs/specs/pages/<이름>/`의 <이름>으로 쓸까요? (kebab-case로 변환: scr-fle-01)"
- options: label `"scr-fle-01 사용"`(description `"추출된 이름 그대로 디렉토리 생성"`) / label `"직접 입력"`(description `"다른 이름을 지정"`)

## [1-재실행] 재실행 시 소스 복원 (dt-spec 설계 §7-1-재실행)

대상 페이지 디렉토리(`docs/specs/pages/<page-kebab>/`)가 이미 존재하면 재실행으로 판단하고 아래를 수행한다.

### 기존 헤더 sources 복원

기존 산출물 헤더를 `parseSpecHeader`로 파싱해 sources를 복원한다.

**specVersion 1.0 자동 마이그레이션**: 옛 `figmaPageNodeId=<id>` → `figma:<id>@design`, `figmaUxWireframeNodeId=<id>` → `figma:<id>@wireframe`으로 무손실 매핑한다. **복원된 Figma 소스는 "이미 역할이 결정된 것"으로 간주 — 역할 재질문 안 함** (결정 9 예외).

### 소스 union

복원 sources와 이번 명령의 새 sources를 union한다:
- 같은 locator → 새 입력이 갱신 (업데이트).
- 다른 locator → 추가.

### union 기준 카디널리티 검증 (Critical)

카디널리티는 **union 결과** 기준으로 검증한다. 복원 figma design + 새 figma design = 2개 → 에러:
"이미 design 노드가 있습니다(헤더 복원)." → AskUserQuestion(원칙 10): "새 노드로 교체"(헤더의 기존 design 소스를 새 것으로 바꾸고 diff-then-confirm으로 갱신) / "기존 노드 유지 — 새 노드는 버림" / "중단".

신규 소스가 기존 소스를 조용히 교체하지 않는다.

`--only <artifact>` 부분 갱신 시에도 동일하게 복원하고 union하되, 산출물 빌드는 지정 artifact만 수행한다.

