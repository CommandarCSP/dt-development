# 위키 어댑터

위키 문서 스킬(`dt-confluence-doc`)과 작업 기록의 관련 문서 찾기(`dt-worklog-sync` 3.7)가 위키에 하는 일을 한 목록으로 둔다. 어떤 위키를 쓰는지는 공통 설정 `.dt.json`의 `wiki`다(`docs/refs/config-schema.md`). 무엇을 어떤 템플릿으로 쓰는지는 위키와 상관없이 `docs/policies/TP-003-wiki-docs.md`가 정한다.

## 1. 지원 상태

| `wiki` | 상태 | 쓰는 곳 |
|---|---|---|
| `confluence` (기본) | 연동 | Confluence 페이지(HTML 본문). 도구 이름·인자는 `docs/refs/atlassian-mcp.md`(v1·v2) |
| `markdown` | 연동 | 저장소의 `docs/wiki/<구역>/[<연도>/]<제목>.md`(경로는 `scripts/wikiConfig.mjs path`). 파일로 쓰고, 커밋은 사람이 한다 |
| `notion` | 스텁 | "아직 연동하지 않는다"고 알리고 `none`처럼 동작한다 |
| `none` | 쓰지 않음 | 본문을 대화에 마크다운으로 보인다. 사람이 원하는 곳에 붙인다 |

스텁 위키를 연동하려면 아래 표의 하는 일마다 그 위키의 도구를 대응시키고, 이 표의 상태를 바꾼다. 스킬 본문은 고치지 않는다.

## 2. 하는 일

| 하는 일 | 뜻 | Confluence | markdown |
|---|---|---|---|
| `spaces` | 문서를 둘 곳 목록 | `confluence.spaces` | (저장소 하나) |
| `pages` | 구역 페이지 찾기 | `confluence.pages` · `confluence.search`(제목) | `docs/wiki/<구역>/` 폴더 |
| `search` | 관련 문서 찾기 | `confluence.search`(CQL) | `docs/wiki/` 아래 제목·본문 grep |
| `create` | 새 문서 | `confluence.create`(HTML) | 파일 쓰기(마크다운) |
| `update` | 기존 문서에 덧붙이기(보수적) | `confluence.update` | 파일 끝에 절 추가 |
| `link` | 문서 주소 | `https://<site>/wiki/spaces/<KEY>/pages/<id>` | 저장소 웹 주소 + 경로(`scripts/gitWebUrl.mjs`) |

## 3. 본문 형식

템플릿(`skills/dt-confluence-doc/references/templates/<종류>.md`)은 하나다. 위키에 맞게 바꿔 쓴다.

- Confluence: HTML. 시각 요소는 `skills/dt-confluence-doc/references/visual-guideline.md`. v2는 서버의 형식 안내(`getContentFormatGuide`)가 우선이다.
- markdown: 표·목록·코드블록은 그대로, 상태 배지는 글자, 결정·태스크 리스트는 `- [ ]` 목록, 패널은 인용(`>`), 2단 레이아웃은 소제목 둘.
