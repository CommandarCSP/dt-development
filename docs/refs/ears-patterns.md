# 참조: EARS 패턴 분류표 + 출처/패턴 라벨 체계

> 종류: **참조 문서(지식)** · 소비처: `dt-spec-generate-spec` [7-1]·[7-2], 향후 `spec-author` 에이전트.
> 성격: 작업 중 고정 단계에서 `Read`로 로드하는 정적 지식(분기·게이트 같은 *행위*는 스킬 본문에 남는다).
> SOT: 라벨 정의의 단일 출처 = 본 문서(이전엔 design doc(2026-06-01) §7-2를 가리켰음). EARS 변환 *행위*(언제 분류·검증하는지)는 dt-spec [7-1]/[7-5]가 소유.

---

## 1. raw → EARS 6패턴 분류표

각 raw 항목을 6가지 EARS 패턴 중 하나로 분류한다:

| Raw 데이터 | EARS 패턴 | 키워드 |
|---|---|---|
| `apiCandidates[].sourceUiElement` (버튼/폼 인터랙션) | Event-driven | `WHEN ... THE SYSTEM SHALL ...` |
| 네비게이션 트리거 (요소 클릭 → 다른 라우트로 이동) | Event-driven | `WHEN <요소> 클릭 THE SYSTEM SHALL <경로>로 이동` |
| `components[]` 중 layer 이름이 `header`/`logo`/`footer`/`nav` 패턴 매칭 (항상 표시 요소) | Ubiquitous | `THE SYSTEM SHALL ...` |
| `pageMeta.accessControl` (비로그인/권한 등) | State-driven | `WHILE ... THE SYSTEM SHALL ...` |
| `scenarios[].state` (loading/empty/error/disabled) | State-driven | `WHILE ... THE SYSTEM SHALL ...` |
| `projectContext`의 feature flag + 조건부 UI | Optional | `WHERE ... THE SYSTEM SHALL ...` |
| `edgeCases[]`, `businessRules[]` (실패/예외) | Unwanted | `IF ... THEN ...` |
| 사용자가 명시한 복합 시나리오 | Complex | `WHEN ..., WHILE ... THE SYSTEM SHALL ...` |
| 비기능 요구사항 (성능, 접근성) | Ubiquitous | `THE SYSTEM SHALL ...` |

**Complex 자동 결합 금지** — 사용자 명시 시에만.

**FR 아님 — 별도 슬롯 배치**:
- `userStories[]` → requirements.md `{{USER_STORIES}}` (FR 변환 X, 그대로 bullet으로 나열)
- `pageMeta.purpose` → design.md 도입부 컨텍스트 또는 requirements.md 상단 1줄 요약 (FR 변환 X)

---

## 2. 출처 / 패턴 라벨 체계

라벨 종류: `ai-confirmed` / `ai-edited` / `user-added` / `[inferred]` (AI 구조 추론분) / `[user-resolved]` (소스 간 충돌 해소분).

전파 규칙:

- 1 API 후보 → 1 FR: 후보의 `source`를 FR로 그대로 전파.
- 1 API 후보 → N FR: 모든 FR에 동일 source (예: emailLogin 후보 → FR-1 이메일 검증 + FR-2 제출 + FR-3 실패 처리 모두 `[ai-confirmed]`).
- 후보의 source가 `ai-edited` → 전파된 FR도 `[ai-edited]` 그대로.
- API 후보 없이 추가된 FR: `[user-added]` 직접 표기 (옵셔널 부연 가능 — `[user-added — 누락 카테고리 체크리스트]`).
- AI 추론으로만 존재하는 FR: `[inferred]` 라벨.
- 소스 간 충돌 해소분: `[user-resolved]` 라벨.
