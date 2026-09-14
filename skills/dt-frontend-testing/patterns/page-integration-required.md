---
ruleId: page-integration-required
summary: "Page 컴포넌트마다 sibling integration test 필수 — 페이지 핵심 흐름은 cross-component까지 검증"
severity: important
appliesTo: ["src/pages/*.tsx"]
detection:
  - type: requires-sibling-test
    testPath: "__tests__/{basename}.integration.test.tsx"
    rationale: "Page는 도메인 컴포넌트들을 조립하는 단위 → 페이지 단위 사용자 흐름을 integration test로 검증해야 회귀 차단 가능. unit/E2E로는 cross-component 협력을 적정 비용으로 잡을 수 없음."
relatedRules: [integration-page, e2e-playwright, integration-domain]
---

# Page 컴포넌트는 sibling integration test 필수

## 왜 이 룰?

페이지는 도메인 컴포넌트들을 조립하는 단위. **페이지 단위 사용자 흐름**(클릭 → 다중 컴포넌트 동기화, 라우팅 파라미터 진입, 캐시 흐름)을 unit test로는 못 잡고, E2E로 잡기엔 비용이 큼.

Page integration test는 그 사이를 메우는 가장 ROI 높은 방어선:
- jsdom + MemoryRouter + MSW + QueryClient → 빠르고(~100~500ms) 안정적
- 도메인 컴포넌트의 실제 협력(cache surgery, invalidate, navigation) 검증
- E2E는 cross-page navigation, 브라우저 native 동작, smoke로 제한

## 구조

```
src/pages/
  MainPage.tsx
  FeedPostDetailPage.tsx
  __tests__/
    MainPage.integration.test.tsx           ← 필수
    FeedPostDetailPage.integration.test.tsx ← 필수
```

## 검증 패턴

```tsx
// MainPage.integration.test.tsx
import { renderPage } from '../../test-utils/renderPage';

describe('MainPage', () => {
  it('추천 [팔로우] 클릭 시 팔로잉 컬럼에 즉시 등장 + 추천에서 사라짐', async () => {
    // Arrange — 페이지 전체 렌더
    renderPage(<MainPage />, { initialRoute: '/' });
    const recommendedSection = await screen.findByRole('region', { name: '추천 유저' });

    // Act
    const followBtn = within(recommendedSection)
      .getByRole('button', { name: /Chelsey.*팔로우/ });
    await userEvent.click(followBtn);

    // Assert — cache surgery + invalidate 흐름 검증
    const followedSection = screen.getByRole('region', { name: '팔로잉' });
    await waitFor(() => {
      expect(within(followedSection).getByText('Chelsey Dietrich')).toBeInTheDocument();
      expect(within(recommendedSection).queryByText('Chelsey Dietrich')).not.toBeInTheDocument();
    });
  });
});
```

## 무엇을 Page integration으로?

**검증 권장**
- 페이지 진입 시 핵심 컴포넌트가 모두 렌더
- 페이지 내 사용자 인터랙션 → 다중 컴포넌트 동기화 (cache 흐름)
- URL param 기반 데이터 로드 (`/feed/:id`)
- 페이지 내 navigation 시작점 (클릭 → navigate 호출 검증)
- 본인/타인 분기 같은 비즈니스 분기

**비권장 (다른 계층으로)**
- 단일 컴포넌트 내부 동작 → 그 컴포넌트의 unit/integration test
- mutation 자체의 로직 → mutation hook의 integration test
- 페이지 간 navigation 후 상태 → E2E (실 history 필요)
- 브라우저 native (focus, scroll, layout) → E2E

## E2E와의 분담

| | Page integration | E2E |
|---|---|---|
| 페이지 진입 시 렌더 | ✓ 메인 책임 | smoke 1건 정도 |
| 다중 컴포넌트 동기화 | ✓ 메인 책임 | × (비싸고 중복) |
| 페이지 간 navigation 후 상태 | △ MemoryRouter로 일부 | ✓ 메인 책임 |
| 브라우저 native (focus/layout) | × | ✓ 메인 책임 |
| 배포 헬스 (smoke) | × | ✓ |

E2E는 **의도적으로 최소화**. Page integration이 메인 방어선.

## 관련 규칙
- [[integration-page]] (Page integration의 작성 패턴)
- [[integration-domain]] (Domain integration과 분담)
- [[e2e-playwright]] (E2E의 적절한 범위)
- [[business-logic-purity]] (sibling test 강제 패턴의 참고)
