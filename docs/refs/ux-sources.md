# UX 소스 어댑터

정의서(`dt-devspec`)와 화면 스펙(`dt-spec`)이 기획·디자인 소스를 어떻게 읽는지 한곳에 둔다. 두 스킬 본문은 도구 이름 대신 아래 "하는 일" 이름과 이 문서의 절을 가리킨다.

**전제: Figma는 없을 수 있다.** 정의서는 Notion·Confluence·PDF·Markdown 같은 기획 문서만으로도 시작한다. Figma가 있으면 화면 구조를 더 정확히 얻을 뿐이고, 없다고 단계가 멈추지 않는다.

## 1. 소스 종류와 읽는 방법

종류 판별은 `scripts/parseSources.mjs`(`parseLocator`)가 한다. `web`은 주소로 다시 나눈다.

| 종류 | 예 | 먼저 쓰는 방법 | 안 되면 |
|---|---|---|---|
| `markdown` | `.md` `.markdown` `.txt` | `Read` | — |
| `pdf` | `.pdf` | `Read`(`pages`로 나눠 읽기) | — |
| `web` · Notion | `notion.so/…` `*.notion.site/…` | 하는 일 `notion.fetch` | `WebFetch`(공개 페이지만) → 그래도 안 되면 묻는다 |
| `web` · Confluence | `*.atlassian.net/wiki/…` | 하는 일 `confluence.get`(`docs/refs/atlassian-mcp.md`) | `WebFetch` → 그래도 안 되면 묻는다 |
| `web` · 그 밖 | `https://…` | `WebFetch` | 묻는다 |
| `figma` | `figma.com/design/…` · `12:34` | 하는 일 `figma.metadata`·`figma.context`(§3) | §4 사전 점검의 선택지 |

"묻는다"는 원칙 10(`docs/orchestration-policy.md`)대로 그만두지 않고 고르게 하는 것이다. 선택지는 "PDF·Markdown으로 내보낸 파일 경로를 준다" / "본문을 붙여 넣는다"(Other) / "이 소스 없이 진행"이다. `WebFetch`로 읽은 본문은 로그인 벽·요약 응답일 수 있다. 제목만 오고 본문이 비었으면 실패로 본다.

## 2. 주 소스 (UX 원본)

소스가 여럿이면 하나를 **주 소스**로 둔다. 화면·기능이 "있는지"를 다툴 때 주 소스가 이긴다(계약면 — 경로·shape — 은 여전히 BE 우선).

- 정하는 순서: 사용자가 `--primary <locator>`나 대화로 지정 → Figma가 있으면 Figma → 없으면 기획 문서 중 첫 번째.
- 소스가 둘 이상이고 Figma가 없으면, 시작할 때 한 번 "어느 문서가 기준인가"를 묻는다(권장: 화면 목록이 있는 문서).

## 3. 하는 일 → 도구

### Figma

접두어는 연결 방식마다 다르다. 연산 이름은 같다.

| 연결 | 접두어 |
|---|---|
| Claude Code 플러그인 | `mcp__plugin_figma_figma__` |
| claude.ai 커넥터 | `mcp__claude_ai_Figma__` |
| Figma 데스크톱·원격 MCP 직접 추가 | `mcp__figma__` |

| 하는 일 | 연산 | 쓰는 곳 |
|---|---|---|
| `figma.metadata` | `get_metadata` | 페이지·화면 트리(id·이름·위치·크기, 가벼움) |
| `figma.context` | `get_design_context` | 한 노드의 본문(글·구조, 무거움) |
| `figma.variables` | `get_variable_defs` | 디자인 토큰 |
| `figma.search` | `search_design_system` | 디자인 시스템 컴포넌트 찾기 |
| `figma.assets` | `download_assets` | 이미지·아이콘 받기 |

스킬 본문은 연산 이름(`get_metadata` 등)이나 하는 일 이름을 쓰고, **접두어를 붙인 전체 이름은 이 표에만 적는다**(구조 테스트가 지킨다).

### Notion

| 연결 | 접두어 | `notion.fetch` 연산 |
|---|---|---|
| claude.ai 커넥터 | `mcp__claude_ai_Notion__` | `notion-fetch` |
| Notion 원격 MCP 직접 추가 | `mcp__notion__` | `notion-fetch` |

## 4. Figma 사전 점검 (Figma 소스가 있을 때만)

Figma 소스가 없으면 건너뛴다. 있으면:

1. 이 세션에 §3의 접두어 중 어느 것이 있는지 본다(도구 목록에서 `get_metadata`로 끝나는 이름). 그 접두어를 이번 실행 내내 쓴다.
2. 없거나, 첫 `figma.metadata` 호출이 인증·권한 오류면 원칙 10대로 묻는다: "연결·권한을 고치고 다시 시도"(`/mcp`) / "Figma 없이 나머지 소스로 진행" / "중단". 다른 소스가 없으면 두 번째 선택지 대신 "기획 문서를 지금 추가"를 낸다.
3. "Figma 없이 진행"이면 그 소스는 `(load-failed)`로 기록하고, 결과물에 Figma 근거가 빠졌다고 적는다(스킬마다 `status: draft` 여부는 그 스킬이 정한다).

## 5. 출처 표기

결과물의 출처 칸은 소스 종류에 맞춰 적는다.

| 종류 | 표기 |
|---|---|
| Figma | `[화면 이름](https://figma.com/design/{fileKey}/{fileName}?node-id={id})` — `:`는 `-`로 |
| Notion · Confluence · 일반 URL | `[페이지 제목 § 절 제목](URL)` |
| PDF | `파일명.pdf p.12` |
| Markdown | `경로.md § 절 제목` |
