---
name: dt-frontend-coding-discipline
description: Use when writing, reviewing, or refactoring code in a project that contains .dt-frontend.json — judgment-based coding discipline (surface assumptions, simplicity-first, surgical changes, goal-driven execution) that complements the mechanical structural rules in dt-frontend-architecture. Apply when about to over-abstract, drive-by refactor, assume requirements silently, or start coding without verifiable success criteria.
license: MIT
---

# dt-frontend Coding Discipline

> **다른 스킬과의 관계**
> - `dt-frontend-architecture` = **기계적 구조 룰** (어느 레이어에 뭘 둘까, import 금지 등 — review가 정규식으로 자동 검출)
> - 본 skill = **판단 규율** (정규식으로 못 잡는, 사람/에이전트가 판단해야 하는 행동 원칙)
> - 검증: `dt-frontend-review`가 본 skill의 항목들을 manual 체크로 참조

LLM 코딩의 흔한 실수를 줄이는 4가지 행동 원칙. [Andrej Karpathy의 관찰](https://github.com/multica-ai/andrej-karpathy-skills)에서 차용(MIT), dt-frontend(React 19 + TS + TanStack Query + Zustand) 맥락으로 번역.

**트레이드오프:** 이 원칙들은 속도보다 신중함에 무게를 둔다. 사소한 작업은 판단껏.

---

## 1. Think Before Coding — 가정하지 말고 드러내라

구현 전에:
- 가정을 명시한다. 불확실하면 **묻는다.**
- **물을 수 없는 상황(자율 실행/서브에이전트)이면** 가정을 명시적으로 적고 가장 합당한 쪽으로 진행한다 — 조용히 고르지 않는다.
- 해석이 여럿이면 임의로 하나 고르지 말고 **제시한다.**
- 더 단순한 방법이 있으면 말한다. 정당하면 밀어붙인다.

**예시 (한 화면 진입 동선 요청):**
```
요청: "프로필 누르면 디테일로 가게 해줘"

❌ 임의 결정: 새 탭? 현재 페이지 navigate? 그냥 골라서 구현
✅ 질문: "현재 페이지 navigate인가요, 새 탭인가요?"
   (물을 수 없으면: "현재 페이지 navigate로 가정하고 진행 — 새 탭이면 알려주세요")
```
- 비즈니스 파라미터(`limit`, `sort`)도 같은 원칙 — Page가 선언하지, Business Hook이 임의 하드코딩하지 않음 (`adding-business-params` 룰과 연결).

## 2. Simplicity First — 요청한 것만, 투기적 코드 없이

- 요청 범위 밖 기능 금지.
- **단일 용도 코드에 추상화 금지.**
- 요청 안 한 "유연성"/"설정 가능성" 금지.
- 일어날 수 없는 시나리오의 에러 처리 금지.

**스스로 물어라:** "시니어 개발자가 이거 과하다고 할까?" → 그렇다면 단순화.

**dt-frontend 사례:**
```ts
// ❌ 과한 추상화 — 단일 용도 hook에 옵션 객체 5개
function useFollowToggleViewModel(opts?: {
  merge?: boolean;
  optimistic?: boolean;
  validate?: boolean;
  onNotify?: () => void;
}) { ... }

// ✅ 필요한 것만 — 실제 코드
function useFollowToggleViewModel() {
  return { followedIds, toggle, isPending };
}
```
- View Component도 마찬가지 — 레이아웃 하나면 되는데 `renderStrategy` prop 같은 거 만들지 않음. 두 번째 케이스가 **실제로** 생기면 그때 리팩토링.

## 3. Surgical Changes — 건드릴 것만, 내 흔적만 치운다

기존 코드 수정 시:
- 인접 코드/주석/포맷팅을 "개선"하지 않는다.
- 안 망가진 걸 리팩토링하지 않는다.
- 내 취향과 달라도 **기존 스타일을 맞춘다.**
- 무관한 dead code를 발견하면 — **언급만 하고 지우지 않는다.**

내 변경이 만든 orphan만 정리(내 변경으로 안 쓰이게 된 import/변수). 기존 dead code는 요청 없이 제거 X.

**테스트: 변경된 모든 줄이 사용자 요청으로 직접 추적되는가?**

**dt-frontend 적용:**
- 한 컴포넌트에 기능을 추가하다 옆의 무관한 dead UI/코드를 발견해도 — 이번 변경 범위 밖이면 **언급만 하고 건드리지 않는다.**
- 새 콜백/인터랙션을 붙일 땐 같은 도메인의 기존 패턴(예: 다른 카드 컴포넌트의 `onClick` 전달 방식)을 따른다 — 새 패턴 발명 X.
- 주석도 같은 원칙 — WHAT 주석/포맷 드리프트 금지 (`dt-frontend-architecture`의 주석 규칙과 연결).

## 4. Goal-Driven Execution — 검증 가능한 성공 기준을 정하고 루프

작업을 검증 가능한 목표로 변환:
- "검증 추가" → "잘못된 입력 테스트 작성 → 통과시키기"
- "버그 수정" → "버그 재현 테스트 작성 → 통과시키기"
- "X 리팩토링" → "전후로 테스트 통과 보장"

멀티스텝이면 간단한 계획을 명시:
```
1. [단계] → verify: [확인 방법]
2. [단계] → verify: [확인 방법]
```

**예시 (동작이 모호한 버그 수정 요청):**
```
요청: "팔로우 기능 고쳐줘"

❌ 약한 기준: "동작하게 만들기"
✅ 강한 기준: "unfollow한 유저가 추천 리스트에 다시 등장하지 않는다"
   → 그 시나리오를 재현하는 regression 가드 테스트로 검증
```
- TDD를 기본으로: RED(실패 테스트) → GREEN(최소 구현) → 검증. `dt-frontend-testing`의 3계층 전략과 결합.

---

## Anti-Pattern 요약

| 원칙 | 안티패턴 | 교정 |
|---|---|---|
| Think Before | 포맷/범위/대상을 임의 가정 | 가정을 명시하고 모호하면 질문 |
| Simplicity | 단일 용도에 Strategy/옵션 객체 | 실제 두 번째 케이스 생길 때까지 함수 하나 |
| Surgical | 버그 고치며 따옴표·타입힌트·인접 코드 변경 | 요청에 직접 추적되는 줄만 변경 |
| Goal-Driven | "리뷰하고 개선하겠다" | "버그 X 재현 테스트 → 통과 → 회귀 없음 확인" |

## 핵심 통찰

과엔지니어링 예시들은 "명백히 틀린" 게 아니라 디자인 패턴/베스트 프랙티스를 **너무 일찍** 적용한 것이다. 타이밍 문제다 — 필요하기 전에 복잡도를 더하면 이해하기 어렵고, 버그가 늘고, 시간이 더 걸리고, 테스트가 어려워진다.

**좋은 코드는 내일의 문제를 미리 푸는 게 아니라 오늘의 문제를 단순하게 푸는 코드다.**

## 작동 신호

이 원칙들이 작동하면: diff에 불필요한 변경이 줄고, 과복잡으로 인한 재작성이 줄고, 명확화 질문이 실수 후가 아니라 구현 전에 나온다.

## 활성화 조건

`.dt-frontend.json`이 있고 `enabledSkills`에 `dt-frontend-coding-discipline`이 포함된 프로젝트에서만 트리거됩니다.
