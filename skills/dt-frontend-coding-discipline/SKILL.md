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

**원칙 본문은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/coding-discipline.md`가 원본이다 — 먼저 읽는다.** 4원칙(Think Before Coding · Simplicity First · Surgical Changes · Goal-Driven Execution)과 안티패턴 표는 그 문서에만 있다. 아래는 dt-frontend(React 19 + TS + TanStack Query + Zustand) 맥락의 예시다.

## 1. Think Before Coding — 이 스택에서

```
요청: "프로필 누르면 디테일로 가게 해줘"

❌ 임의 결정: 새 탭? 현재 페이지 navigate? 그냥 골라서 구현
✅ 질문: "현재 페이지 navigate인가요, 새 탭인가요?"
   (물을 수 없으면: "현재 페이지 navigate로 가정하고 진행 — 새 탭이면 알려주세요")
```
- 비즈니스 파라미터(`limit`, `sort`)는 Page가 선언하지, Business Hook이 임의 하드코딩하지 않음 (`adding-business-params` 룰과 연결).

## 2. Simplicity First — 이 스택에서

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
- View Component도 마찬가지 — 레이아웃 하나면 되는데 `renderStrategy` prop 같은 거 만들지 않음.

## 3. Surgical Changes — 이 스택에서

- 한 컴포넌트에 기능을 추가하다 옆의 무관한 dead UI/코드를 발견해도 — 이번 변경 범위 밖이면 **언급만 하고 건드리지 않는다**(인접 코드 개선 금지).
- 새 콜백/인터랙션을 붙일 땐 같은 도메인의 기존 패턴(예: 다른 카드 컴포넌트의 `onClick` 전달 방식)을 따른다 — 새 패턴 발명 X.
- 주석 — WHAT 주석/포맷 드리프트 금지 (`dt-frontend-architecture`의 주석 규칙과 연결). 단, **내가 바꾼 비즈니스 규칙의 결정 로그를 갱신하는 것은 드리프트가 아니다** — 그 규칙이 요구하는 작업이다.

## 4. Goal-Driven Execution — 이 스택에서

```
요청: "팔로우 기능 고쳐줘"

❌ 약한 기준: "동작하게 만들기"
✅ 강한 기준: "unfollow한 유저가 추천 리스트에 다시 등장하지 않는다"
   → 그 시나리오를 재현하는 regression 가드 테스트로 검증
```
- `dt-frontend-testing`의 3계층 전략과 결합.

## 활성화 조건

`.dt-frontend.json`의 `enabledSkills`에 `dt-frontend-coding-discipline`이 포함된 프로젝트에서 트리거됩니다. **파일이 없으면 `${CLAUDE_PLUGIN_ROOT}/docs/refs/stack-config-bootstrap.md` 절차로 만들고 계속합니다.**
