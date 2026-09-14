---
ruleId: test-anti-patterns
summary: "hook mock / setTimeout / 구현 디테일 결합 / snapshot 남용 / 순서 의존 금지"
severity: important
appliesTo: ["src/**/__tests__/**/*.{ts,tsx}", "e2e/**/*.spec.ts"]
detection:
  - type: forbidden-pattern
    pattern: "setTimeout[ ]*[(]"
    rationale: "테스트 내 raw setTimeout은 flaky 원인. vi.useFakeTimers() + advanceTimersByTime, 또는 waitFor 사용"
  - type: forbidden-pattern
    pattern: "await new Promise[ ]*[(][ ]*[(]?r"
    rationale: "수동 sleep(await new Promise(r => setTimeout(r, ...))) 금지 — flaky. waitFor 사용"
relatedRules: [test-double-selection, flaky-test-prevention, integration-no-hook-mocking]
---

# 테스트 안티패턴

테스트는 "있으면 좋은 것"이 아니라 "회귀를 잡는 안전망"이라야 가치 있음. 아래 안티패턴은 테스트를 **거짓 안심**으로 바꿔 더 위험하게 만든다.

## 자동 검출되는 항목 (review가 잡음)

### ❌ `setTimeout` 직접 사용
```ts
// 안티
setTimeout(() => { /* check */ }, 1000);

// ✅ 대신
await waitFor(() => expect(...).toBe(...), { timeout: 3000 });
// 또는 (실제 타이머 의존 SUT일 때)
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
```

### ❌ 수동 sleep
```ts
// 안티
await new Promise((r) => setTimeout(r, 500));

// ✅ 대신
await waitFor(() => expect(result.current.data).toBeDefined());
```

## 자동 검출 안 되지만 리뷰에서 잡아야 할 안티패턴

### ❌ Hook 자체를 mock
```ts
vi.mock('../../store/queries/follows/useFollowedUsersQuery', () => ({
  useFollowedUsersQuery: () => ({ data: [...], isSuccess: true }),
}));
```
통합 테스트의 의미가 사라짐. [[integration-no-hook-mocking]] 참조. MSW로 응답을 stub 하라.

### ❌ 구현 디테일에 결합
```ts
// 안티 — 내부 state 이름이 바뀌면 깨짐
expect(component.state.internalCounter).toBe(3);

// ✅ — 사용자/소비자가 관찰 가능한 동작 검증
expect(screen.getByText('3개')).toBeInTheDocument();
```

### ❌ snapshot 남용
```ts
// 안티 — 의도 불명, 매번 깨지면 그냥 update
expect(rendered).toMatchSnapshot();

// ✅ — 명시적 assertion
expect(screen.getByRole('button')).toHaveTextContent('팔로우');
expect(screen.getByRole('button')).not.toBeDisabled();
```

> snapshot은 출력이 매우 안정적이고 거대한 경우(MDX 렌더링 같은)만. 일반 컴포넌트엔 비추.

### ❌ 여러 동작을 한 테스트에 묶음
```ts
// 안티
it('전체 시나리오', async () => {
  // login
  // fetch
  // click
  // assert 1
  // click
  // assert 2
  // logout
});
```
실패 시 어디서 깨졌는지 불명. **한 테스트 = 한 동작** 원칙 유지.

### ❌ 테스트 간 순서 의존
```ts
let sharedData;
it('first creates data', () => { sharedData = create(); });
it('second reads it', () => { expect(sharedData).toBeDefined(); }); // 첫 테스트가 빠지면 깨짐
```
각 테스트는 독립적이어야. beforeEach로 setup, afterEach로 teardown.

### ❌ 깊은 mock 사슬
```ts
vi.mock('../../store/queries/...');
vi.mock('../../services/...');
vi.mock('../../business/...');
```
이 정도면 테스트가 아니라 새 코드를 작성한 것. 실제 hook 그대로 + MSW로 응답만 stub.

### ❌ assertion 없는 테스트
```ts
it('렌더링된다', () => {
  render(<Component />);
  // expect 없음 — throws 안 하면 pass
});
```
적어도 한 개의 의미있는 assertion 필요.

### ❌ "구현이 잘 되어 있다"는 테스트
```ts
// 안티
it('Map을 사용해야 한다', () => {
  // 구현 강제 — 구현 변경 시 깨짐
});

// ✅
it('id로 빠르게 조회된다', () => {
  // 동작 검증 — 구현은 자유
});
```

## E2E 안티패턴

### ❌ 하드코딩 sleep
```ts
await page.waitForTimeout(2000); // 안티
```
```ts
await expect(page.getByText('로딩 완료')).toBeVisible(); // ✅
```

### ❌ 외부 네트워크 의존
- e2e는 MSW + fixture로 격리. 실제 jsonplaceholder/dicebear 호출 X.

## 관련 규칙
- [[integration-no-hook-mocking]]
- [[test-double-selection]]
- [[flaky-test-prevention]]
- [[view-test-props-only]]
