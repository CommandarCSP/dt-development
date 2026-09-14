---
ruleId: lift-state-only-as-needed
summary: "state는 필요한 최소 컴포넌트 트리 위치에 둠, 무분별한 lifting 금지"
severity: suggestion
appliesTo: ["src/**/*.{tsx,ts}"]
detection:
  - type: pattern-rule
    description: "전역 store나 상위 컴포넌트에 올라가 있는 state가 실제로는 하나의 컴포넌트에서만 쓰이는 경우를 감지. (이 검사는 Plan 2에서 구현)"
source: "vercel-labs/agent-skills/skills/react-best-practices"
placeholder: true
---

# State는 필요한 최소 범위에만 올린다

state를 필요 이상으로 상위 컴포넌트나 전역 스토어에 올리지 않는다.
state를 사용하는 컴포넌트 가장 가까운 위치에 co-locate한다.

## 왜 중요한가

- 불필요하게 올린 state는 관련 없는 컴포넌트를 리렌더링시킨다.
- 전역 스토어 남용은 데이터 흐름을 파악하기 어렵게 만든다.
- co-location을 유지하면 컴포넌트 재사용성과 테스트 용이성이 높아진다.

## ❌ Incorrect

```tsx
// 부모가 자식 전용 UI 상태를 관리
function Page() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // 자식만 씀
  return <Toolbar isOpen={isDropdownOpen} onToggle={setIsDropdownOpen} />;
}
```

## ✅ Correct

```tsx
// 자식이 자신의 UI 상태를 직접 관리
function Toolbar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  return <Dropdown isOpen={isDropdownOpen} onToggle={() => setIsDropdownOpen(v => !v)} />;
}
```

## 언제 올리는가

두 형제 컴포넌트가 같은 state를 공유해야 할 때만 공통 부모로 올린다.
여러 페이지에 걸쳐 공유되는 UI 상태(예: viewMode, 필터)는 Zustand UI Store를 사용한다.

## 이 프로젝트에서의 적용

- 단일 컴포넌트 로컬 상태: `useState` in the component
- 도메인 공유 UI 상태: `src/store/stores/` (Zustand)
- 서버 상태: `src/store/queries/` (TanStack Query)
