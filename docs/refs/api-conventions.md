# API 규칙 프리셋

정의서의 전역 규약 중 **URL 규칙**을 §3 협의에서 어떻게 묻는지 정한다. 값은 언제나 §3에서 사람이 정하고, 프리셋은 질문의 **제안값**만 바꾼다. 고르는 곳은 `.dt.json`의 `conventions.preset`(`docs/refs/config-schema.md`)이다.

## `rest-v1` (기본)

아래 다섯 항목을 한 묶음으로 제안한다. "이대로" 하나로 확정할 수 있고, 항목별로 바꿀 수도 있다.

| 항목 | 제안값 | 예 |
|---|---|---|
| 접두어 | `/api/v1` | `/api/v1/images` |
| 리소스 이름 | 복수형 명사 | `images`, `order-items` |
| 단어 구분 | 케밥케이스 | `order-items` |
| 표준 CRUD | HTTP 메서드로 | 목록 `GET /images` · 등록 `POST /images` · 수정 `PATCH /images/{id}` · 삭제 `DELETE /images/{id}` |
| CRUD 밖 동작 | `POST /{resource}/{action}` | `POST /images/{id}/publish` |

확정되면 §2가 각 IF의 리소스·동작에 이 규칙을 기계적으로 적용해 경로를 만든다(D1). 그 IF는 `컨벤션` 상태가 된다.

## `custom`

모양을 전제하지 않는다. §3에서 항목마다 빈칸으로 묻는다 — 접두어(없음 포함) · 리소스 이름 규칙 · 단어 구분 · 메서드 쓰는 법 · CRUD 밖 동작 표기. GraphQL·RPC처럼 경로 규칙이 없는 팀은 "경로 규칙 없음"을 고르면 된다. 그러면 §2는 경로를 만들지 않고, 각 IF의 경로(또는 연산 이름)를 §3에서 하나씩 묻는다.

## 함께 쓰는 곳

- `dt-devspec` §2(경로 도출)·§3(질문)
- `dt-bespec-collect-project-context`의 "API 버전 prefix" — 정의서의 URL 규칙이 있으면 그것을 따른다
- FE 스택 설정 `apiPrefix`(`docs/refs/stack-config.md`) — mock 경로를 만들 때 쓰는 접두어. 정의서의 접두어와 같게 둔다
