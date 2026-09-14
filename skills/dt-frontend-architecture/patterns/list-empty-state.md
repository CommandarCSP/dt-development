---
ruleId: list-empty-state
summary: "배열 .map 렌더와 로딩 분기를 가진 목록 컴포넌트는 '비어 있고 로딩 아님' 상태의 빈 상태 UI(안내 문구)를 갖춘다"
severity: important
appliesTo: ["src/components/view/**/*.{ts,tsx}", "src/components/domain/**/*.{ts,tsx}"]
detection:
  - type: ast-rule
    description: "컴포넌트가 (1) 배열을 `.map(...)`으로 렌더하고 (2) 로딩 분기(isLoading/isPending 등)를 가진 목록형이면, `데이터.length === 0 && !isLoading`(비어 있고 로딩 아님) 조건의 빈 상태 UI(안내 문구를 담은 요소)가 있어야 한다. 로딩 분기와 map만 있고 빈 상태 분기가 없으면 위반. 로딩·에러가 상위(Suspense/ErrorBoundary·throwOnError)에서 처리되어 컴포넌트에 명시적 isLoading이 없더라도, `.map`으로 목록을 렌더하면 빈 배열일 때의 안내 문구가 있어야 한다. 수동 검토."
relatedRules: [pure-view-component, error-boundary-required]
---

<!-- from: audit 2026-07-24-all A-001/A-002 -->

# 목록 컴포넌트는 빈 상태를 표시한다

## 왜 중요한가
목록이 로딩·데이터 두 분기만 가지면, 데이터가 비었을 때 사용자에게 **아무것도**
보이지 않는다.
- 사용자는 "로딩이 덜 됐나", "고장인가"를 구분할 수 없다
- 팔로잉/추천/검색 결과가 0건인 것은 정상 상태이며, 그 사실을 알려야 한다
- 로딩·에러는 별도 계층(Suspense·ErrorBoundary)이 가려도 "0건"은 목록 컴포넌트의 책임이다

세 상태 — 로딩 / 데이터 있음 / **비어 있음** — 모두를 다뤄야 목록이 완결된다.

## ❌ Incorrect

```tsx
// 로딩·목록만 — users가 비면 h2만 남고 화면이 텅 빈다
export function FollowedUserList() {
  const { users, isLoading } = useFollowedUserListViewModel();
  return (
    <section>
      <h2>팔로잉</h2>
      {isLoading && <p>로딩 중...</p>}
      {!isLoading && users.map((u) => <UserCard key={u.id} user={u} />)}
    </section>
  );
}
```
(현재 실측 프로젝트의 `FollowedUserList`/`RecommendedUserList` 케이스 — `users.length === 0 && !isLoading`
빈 상태 분기가 없어 0건일 때 안내가 표시되지 않는다.)

## ✅ Correct

```tsx
export function FollowedUserList() {
  const { users, isLoading } = useFollowedUserListViewModel();
  const isEmpty = !isLoading && users.length === 0;
  return (
    <section>
      <h2>팔로잉</h2>
      {isLoading && <p>로딩 중...</p>}
      {isEmpty && <p className="text-sm text-muted-foreground">팔로잉한 유저가 없습니다</p>}
      {!isLoading && users.map((u) => <UserCard key={u.id} user={u} />)}
    </section>
  );
}
```

## 관련 규칙
- [[pure-view-component]]
- [[error-boundary-required]]
