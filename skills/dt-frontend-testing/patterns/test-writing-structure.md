---
ruleId: test-writing-structure
summary: "AAA(Arrange/Act/Assert), 명확한 네이밍, 한 테스트=한 동작, fixture는 Builder로"
severity: minor
appliesTo: ["src/**/__tests__/**/*.{ts,tsx}", "e2e/**/*.spec.ts"]
detection: []
relatedRules: [test-case-design-techniques, test-double-selection, test-anti-patterns]
---

# 테스트 코드 작성 구조 (AAA / 네이밍 / Builder / 파일 suffix)

테스트 코드는 "동작하는 스펙 문서"다. 케이스를 찾아냈으면([[test-case-design-techniques]]) 다음은 "어떻게 명확하게 코드로 표현할까". 아래 규약을 따른다.

## 0. 파일명 컨벤션 (suffix)

| 종류 | suffix | 도구 | 예 |
|---|---|---|---|
| Unit | `*.unit.test.ts(x)` | Vitest | `feedBusiness.unit.test.ts`, `UserCard.unit.test.tsx` |
| Integration | `*.integration.test.ts(x)` | Vitest | `useFollowToggleMutation.integration.test.tsx`, `FeedPostDetail.integration.test.tsx` |
| E2E | `*.spec.ts` | Playwright | `main.spec.ts` |

**판정 기준**:
- **Unit** — 단일 SUT(함수 하나, hook 하나, view 하나). MSW로 외부만 stub.
- **Integration** — 2개 이상의 hook/레이어가 협력. (예: query + mutation, hook + router, 다중 query 합성)
- **E2E** — 사용자 시나리오. Playwright + 브라우저.

**판정 모호 시** → integration 쪽으로 (안전).

**package.json scripts 예**:
```json
{
  "test": "vitest",
  "test:unit": "vitest --run unit.test",
  "test:integration": "vitest --run integration.test",
  "test:e2e": "playwright test"
}
```

> Vitest의 기본 testMatch가 `*.test.ts(x)`를 포함하므로 suffix를 추가해도 자동 발견됨. 별도 vitest config 변경 불필요.

## 1. AAA — Arrange / Act / Assert

세 단계로 명확히 구분되어야 한다. 빈 줄 또는 주석으로 시각적 구분 권장.

```ts
it('미팔로잉 유저에 toggle → 팔로우 (followedIds에 추가)', async () => {
  // Arrange — 환경 준비
  const { result } = renderHook(() => useFollowToggleViewModel(), {
    wrapper: makeWrapper(),
  });
  await waitFor(() => expect(result.current.followedIds.size).toBe(3));

  // Act — SUT 동작 실행
  await act(async () => {
    result.current.toggle(chelsey);
  });

  // Assert — 기대 결과 검증
  await waitFor(
    () => expect(result.current.followedIds.has(5)).toBe(true),
    { timeout: 3000 },
  );
});
```

### 레이어별 AAA 매핑

| 레이어 | Arrange | Act | Assert |
|---|---|---|---|
| **순수 함수 (Business)** | 입력 데이터 정의 | 함수 호출 | `expect(result).toEqual(...)` |
| **View 컴포넌트** | `render(<C {...props} />)` + `vi.fn()` 콜백 | `userEvent.click/type(...)` | `expect(screen.getBy*)` / `expect(spy).toHaveBeenCalledWith(...)` |
| **Business Hook (Unit)** | `renderHook(...)` + `waitFor(isSuccess)` | `result.current.callMethod(...)` (보통 `act`로 감쌈) | `waitFor(() => expect(result.current.data).toEqual(...))` |
| **Store Query (Unit)** | `renderHook(...)` | (대부분 Arrange 즉시 fetch) | `waitFor(isSuccess)` + `expect(data)` |
| **Domain (Integration)** | `render(<DomainComp />)` with QC + Router providers | `userEvent.click(...)` | `findByText`, navigation 호출, 캐시 변경 |
| **Page (Integration)** | `MemoryRouter initialEntries` + render | URL 진입 또는 클릭 | DOM/route 검증 |
| **E2E** | `page.goto(...)` | `page.getByRole(...).click()` | `await expect(locator).toBeVisible()` |

### ❌ 안티: AAA 뒤섞기

```ts
it('bad', async () => {
  const { result } = renderHook(...);   // Arrange
  await waitFor(() => expect(result.current.isSuccess).toBe(true)); // Assert?
  await act(() => result.current.toggle()); // Act
  await waitFor(() => expect(...).toBe(...)); // Assert
  await act(() => result.current.toggle()); // Act 또?
  expect(...); // Assert 또?
});
```
여러 Act/Assert가 섞이면 실패 위치 추적 어려움. 분리하거나 `describe`로 묶을 것.

## 2. 테스트 이름 = 명세서

### 기본 패턴

```
should_<기대 결과>_when_<조건>
```

또는 한국어:

```
<조건>일 때 <결과>
```

### 좋은 예 (우리 코드베이스)

- ✅ `'follow=true 호출 시 followKeys.me 캐시에 user가 추가된다 (optimistic + invalidate)'`
- ✅ `'팔로잉 중인 유저에 toggle → 언팔로우 (followedIds에서 제거)'`
- ✅ `'isFollowing=true → 버튼 텍스트 "팔로잉" + aria-pressed=true'`
- ✅ `'mutation 실패 시 캐시가 롤백된다'`

### 나쁜 예

- ❌ `'works'` — 무엇이?
- ❌ `'test 1'` — 의미 없음
- ❌ `'잘 동작한다'` — 무엇이? 어떤 조건에서?
- ❌ `'팔로우 + 언팔로우 + 에러 처리'` — 한 테스트에 다중 동작 (한 테스트 = 한 동작 위반)

### describe 활용

도메인/SUT/조건별로 계층화:

```ts
describe('useFollowToggleMutation', () => {
  describe('follow=true', () => {
    it('낙관적 캐시 업데이트', () => {});
    it('서버 200 응답 시 invalidate', () => {});
    it('서버 500 응답 시 롤백', () => {});
  });
  describe('follow=false', () => { /* ... */ });
});
```

리포트가 자동으로 "useFollowToggleMutation > follow=true > 낙관적 캐시 업데이트" 식으로 트리화.

## 3. 한 테스트 = 한 동작 (Single Responsibility)

- 한 `it` = 한 시나리오 한 assertion 그룹
- 여러 시나리오는 별도 `it` 또는 `it.each`로 분리
- "데이터 fetch → 클릭 → 또 fetch → 또 클릭 → 검증" 식의 거대한 시퀀스 → 단계별로 쪼개기

### ✅ `it.each` 활용 — 같은 동작 × 여러 입력

```ts
it.each([
  ['빈 배열', [], new Set()],
  ['단일 id', [{ id: 1 }], new Set([1])],
  ['중복 id', [{ id: 1 }, { id: 1 }, { id: 2 }], new Set([1, 2])],
])('followedIdSet — %s', (_label, input, expected) => {
  expect(followedIdSet(input)).toEqual(expected);
});
```

## 4. BDD 스타일 (옵션)

Given-When-Then을 코드 주석으로 명시하는 변형. AAA와 1:1 대응:

```ts
it('팔로잉 유저가 추천 카드 [팔로우] 클릭 시 양쪽 리스트가 동기화된다', async () => {
  // Given: 사용자가 메인 페이지에 있고, 추천 리스트에 Chelsey가 보임
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Chelsey 팔로우/ })).toBeVisible();

  // When: Chelsey 카드의 [팔로우] 버튼을 클릭
  await page.getByRole('button', { name: /Chelsey 팔로우/ }).click();

  // Then: 팔로잉 리스트에 Chelsey 등장, 추천에서 사라짐
  await expect(page.getByRole('region', { name: '팔로잉' }).getByText('Chelsey')).toBeVisible();
  await expect(page.getByRole('region', { name: '추천' }).getByText('Chelsey')).not.toBeVisible();
});
```

**언제 BDD?** 사용자 시나리오를 표현하는 **통합/E2E 테스트**에서 가독성↑. 순수 함수 단위 테스트엔 과함 — AAA 충분.

## 5. Test Data Builder

같은 fixture 객체를 여러 테스트에서 반복 생성하지 말 것. **Builder 함수**로 분리.

### Before (현재 — 분산되어 있음)

```ts
// useFollowToggleMutation.test.tsx
const newUser = { id: 5, name: 'Chelsey Dietrich', username: 'chelsey', email: '...', avatarUrl: '...' };

// useFollowToggleViewModel.test.tsx
const chelsey = { id: 5, name: 'Chelsey Dietrich', username: 'chelsey', email: '...', avatarUrl: '...' };
// 같은 데이터 두 번 정의
```

### After — fixture 헬퍼

```ts
// src/test-utils/userBuilder.ts
import { avatarUrl } from '../mocks/fixtures/cdn';
import type { FollowedUserDto } from '../services/follows/types';

export function aUser(overrides: Partial<FollowedUserDto> = {}): FollowedUserDto {
  return {
    id: 999,
    name: 'Test User',
    username: 'tester',
    email: 'test@example.com',
    avatarUrl: avatarUrl('tester'),
    ...overrides,
  };
}
```

```ts
// 테스트
const chelsey = aUser({ id: 5, name: 'Chelsey Dietrich', username: 'chelsey' });
const ervin   = aUser({ id: 2, name: 'Ervin Howell',     username: 'ervin' });
```

장점:
- DTO 필드 추가 시 빌더 한 곳만 수정
- "이 테스트가 신경 쓰는 필드"만 명시 (id, name) → 의도 명확

### 언제 만들지

| 상황 | 권장 |
|---|---|
| 같은 fixture를 2+ 파일에서 반복 | 빌더 분리 |
| 1회용 인라인 객체 | 그냥 인라인 OK |
| 필드 수 많고 기본값 필요 | 빌더 (override 패턴) |

## 6. 체크리스트

테스트 작성 후 셀프 리뷰:

- [ ] Arrange / Act / Assert가 시각적으로 구분되는가
- [ ] 이름이 "조건 + 결과"를 담는가
- [ ] 한 `it` = 한 동작인가
- [ ] 같은 fixture를 다른 파일에서 또 만들고 있진 않은가
- [ ] [[test-anti-patterns]]의 항목 어느 것에도 해당 안 되는가
- [ ] 비동기/타이머/순서 의존이라면 [[flaky-test-prevention]] 가이드 따랐는가

## 관련 규칙
- [[test-case-design-techniques]] (무엇을 검증할지)
- [[test-double-selection]] (어떻게 격리할지)
- [[test-anti-patterns]] (피해야 할 것)
- [[flaky-test-prevention]] (안정성)
