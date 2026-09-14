---
ruleId: test-double-selection
summary: "MSW=Stub/Fake, vi.fn=Spy, fake-indexeddb=Fake — 더블 종류 의식하고 선택"
severity: minor
appliesTo: ["src/**/__tests__/**/*.{ts,tsx}"]
detection: []
relatedRules: [integration-no-hook-mocking, msw-handler-design, unit-business-hook]
---

# Test Double 선택 가이드 (Stub / Spy / Mock / Fake)

테스트에서 "의존성을 격리"한다고 같은 도구만 쓰지 말 것. 5가지 더블의 의미와 우리 도구가 어디에 해당하는지 정확히 알고 선택한다.

## 5 더블 정의

| 더블 | 역할 | 검증 대상 |
|---|---|---|
| **Dummy** | 자리만 채움, 동작 없음 | 없음 |
| **Stub** | 미리 정의된 고정 응답 반환 | **상태** (반환값으로 SUT 동작 검증) |
| **Spy** | 실제 동작 + 호출 기록 | **상호작용** (몇 번/어떻게 불렸나) |
| **Mock** | 기대 동작 사전 정의 + 자동 검증 | **상호작용** (호출 순서/인자) |
| **Fake** | 동작하는 경량 구현 | **통합 수준 상태** |

## dt-frontend 도구 → 더블 매핑

| 도구 | 일반적 용도 | 더블 종류 |
|---|---|---|
| **MSW handlers** (`http.get(...)`) | 고정 응답 | **Stub** |
| **MSW + Dexie + fake-indexeddb** (현 setup) | 영속 + CRUD 동작 | **Fake** (가짜 백엔드) |
| **vi.fn()** without impl | 호출 기록만 | **Spy** |
| **vi.fn().mockReturnValue(x)** | 고정 응답 + 기록 | **Stub + Spy 혼합** |
| **vi.fn().mockResolvedValue(x)** | 비동기 고정 응답 | **Stub** |
| **`{ onClick: vi.fn() }` props in view test** | 호출 검증 | **Spy** |
| **vi.mock('../module', ...)** | 모듈 전체 교체 | **Mock** (지양 — 아래 안티 참조) |
| **fake-indexeddb/auto** | 메모리 IDB | **Fake** |

## 선택 기준 — 우리 컨텍스트

### View 컴포넌트 단위 테스트
- **Spy** (`vi.fn()`)를 콜백 props에 주입
- 예: `<UserCard onToggleFollow={vi.fn()} />` → click 시 callback 호출 확인
- ❌ View 테스트에서 MSW/Stub 거의 불필요

### Business Hook 단위 테스트 (순수 함수 부분)
- **Double 없음** — 순수 함수는 그냥 호출/반환 비교
- 예: `toFeedPost(dto)` 직접 호출

### Store Query / Business Hook 통합 테스트
- **Fake** (MSW + Dexie 그대로) 권장
- Stub만 쓰고 싶으면 `server.use(http.get(...))`로 일회성 응답 덮어쓰기
- ❌ Hook 자체를 `vi.mock`으로 Mock 금지 — [[integration-no-hook-mocking]]

### Domain 컴포넌트 통합 테스트
- 실제 hook + MSW(Fake) 사용
- 라우터: `MemoryRouter` (실제 컴포넌트, double 아님)

### 시간/타이머
- **Stub** — `vi.useFakeTimers()` + `vi.advanceTimersByTime(n)`
- 무한 대기 / setTimeout 의존 코드에서 필수

### 외부 CDN (DiceBear, Picsum)
- 본 프로젝트는 onUnhandledRequest 화이트리스트로 그냥 통과
- 테스트에서 검증 필요시 MSW 핸들러 추가 (**Stub**)

## 선택 의사결정 트리

```
SUT가 반환값/상태만 사용 → Stub (MSW or mockResolvedValue)
호출이 일어났는지 확인 필요 → Spy (vi.fn())
호출 인자가 의미 있음 → Spy + assertion (toHaveBeenCalledWith)
시간 / 무작위 / Date → Stub (useFakeTimers, vi.spyOn(Date, ...))
DB/저장소 동작이 핵심 → Fake (MSW + Dexie)
모듈 전체를 교체해야 함 → Mock (vi.mock) — 안티패턴 가능성 높음, 다른 옵션 우선 검토
```

## 흔한 실수

1. **모든 의존성을 Mock** — 통합 테스트 의미 소실. [[integration-no-hook-mocking]]
2. **Stub인데 Spy처럼 검증** — `mockResolvedValue` 해놓고 호출 횟수 검증 안 함 → 사용 의도 불명
3. **Fake를 매번 재구현** — 우리는 Dexie + MSW로 한 번 구축됨. 재사용
4. **`vi.mock`으로 React/TQ 내부 교체** — 거의 항상 잘못된 추상화 레벨

## 관련 규칙
- [[integration-no-hook-mocking]]
- [[msw-handler-design]]
- [[test-anti-patterns]]
