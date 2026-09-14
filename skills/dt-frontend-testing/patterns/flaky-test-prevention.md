---
ruleId: flaky-test-prevention
summary: "waitFor + 적절한 timeout, setTimeout/raw sleep 금지, cross-tree subscription 누락은 hook들을 한 트리에서 묶어 호출"
severity: important
appliesTo: ["src/**/__tests__/**/*.{ts,tsx}", "e2e/**/*.spec.ts"]
detection: []
relatedRules: [test-anti-patterns, msw-handler-design, integration-no-hook-mocking]
---

# Flaky Test 예방

"가끔 깨지는 테스트"는 단순히 짜증나는 게 아니라 **회귀 신호를 묻어버리는 노이즈**다. 신뢰가 떨어지면 팀이 빨간 빌드를 무시하게 됨. 아래 케이스를 의식하고 방어한다.

## 우리 환경에서 실제로 발생한 케이스

### 1. waitFor 기본 timeout 1000ms가 모자라는 케이스

**증상**: optimistic mutation + invalidate 후 refetch가 1000ms 안에 안 끝나서 간헐 실패.

**원인**: setQueryData → mutationFn(네트워크) → onSettled invalidate → refetch → cache update → React rerender. 의외로 800~1500ms 소요.

**해결**:
```ts
await waitFor(
  () => expect(result.current.data).toEqual(expected),
  { timeout: 3000 }, // mutation+invalidate 동반 시 명시
);
```

### 2. React 19 + TanStack Query v5 + Vitest 4 cross-tree subscription 누락

**증상**: 같은 wrapper(같은 QueryClient)로 `renderHook(A)` + `renderHook(B)`를 따로 호출하면, B에서 `qc.setQueryData`를 해도 A의 hook이 re-render 안 됨. 캐시는 변경됐지만 hook의 `result.current.data`는 stale.

**원인 추정**: 두 별도 React 트리에서 같은 QC 사용 시 observer 알림 누락 (조사 필요).

**해결 — `useCombined` 패턴**:
```ts
function useCombined() {
  return {
    followed: useFollowedUsersQuery(),
    mutation: useFollowToggleMutation(),
  };
}

const { result } = renderHook(useCombined, { wrapper });
// result.current.followed.data 가 정상적으로 mutation 반영
```

> 한 트리 안에서 두 hook을 묶어 호출 → subscription 정상.

### 3. fake-indexeddb 격리 부족

**증상**: 앞 테스트의 DB 상태가 다음 테스트에 leak.

**해결** (`setupTests.ts`):
```ts
import 'fake-indexeddb/auto';

beforeEach(async () => {
  await resetDb();        // 모든 테이블 clear
  await ensureSeeded();   // fixture로 재seed
});
```

### 4. MSW 핸들러 override 누수

**증상**: 한 테스트에서 `server.use(...500...)`로 override한 게 다음 테스트로 leak.

**해결**:
```ts
afterEach(() => server.resetHandlers());
```
setupTests에 이미 있음. 빠뜨리지 말 것.

## 일반적인 flaky 방지 체크리스트

### 비동기
- [ ] `waitFor`로 폴링 (적절한 timeout)
- [ ] `act()` 안에서 setState 트리거 (RTL이 대부분 자동 처리)
- [ ] `await screen.findByText(...)` (찾을 때까지 대기, 미존재 → throw)
- [ ] 절대 `setTimeout` / `await sleep(...)` 사용 금지

### 시간/날짜
- [ ] `vi.useFakeTimers()` + `vi.advanceTimersByTime(n)`
- [ ] `vi.setSystemTime(new Date('2024-01-01'))`
- [ ] `Date.now`를 직접 모킹하지 말 것 — `vi.useFakeTimers`가 표준

### 무작위
- [ ] `Math.random` 의존 코드는 seed-based로 리팩토링 또는 `vi.spyOn(Math, 'random').mockReturnValue(...)`

### 순서 의존
- [ ] 각 테스트가 단독 실행 가능해야
- [ ] `beforeEach`/`afterEach`로 setup/teardown
- [ ] `it.each`로 케이스 분리 (loop 안 i 변수 의존 X)

### 동시성
- [ ] Vitest는 기본 파일별 병렬. 같은 파일 내 테스트는 직렬
- [ ] 공유 자원(Dexie singleton 등)은 beforeEach reset

### DOM
- [ ] `screen.getByRole`/`findByRole` 사용 (안정적 selector)
- [ ] `data-testid`는 최후의 수단 — semantic role 우선
- [ ] CSS module 클래스명 직접 검증 금지 (hash 변경 시 깨짐)

### E2E (Playwright)
- [ ] `await expect(locator).toBeVisible()` 사용 (auto-wait)
- [ ] `page.waitForTimeout(ms)` 금지
- [ ] 네트워크 응답 대기는 `page.waitForResponse` 또는 MSW로 stub
- [ ] 드롭다운·팝오버 등 오버레이 항목 클릭 전 `scrollIntoViewIfNeeded()` 또는 뷰포트 내 노출 확인 — 병렬 부하에서 뷰포트 밖 클릭은 간헐 실패한다(실측 확인)

## 디버깅 팁

flaky로 의심되면:
1. **단독 실행** vs **전체 실행** 차이 비교 (state leak 후보)
2. `--repeat=10`으로 반복 실행
3. `console.log`로 시점 trace (해결 후 제거)
4. timeout을 30000ms로 늘려 race vs deadlock 구분

## 관련 규칙
- [[test-anti-patterns]] (setTimeout/sleep 자동 검출)
- [[msw-handler-design]]
- [[integration-no-hook-mocking]]
