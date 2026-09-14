---
name: dt-backend-coding-discipline
description: Use when writing, reviewing, or refactoring code in a project that contains .dt-backend.json — judgment-based coding discipline (surface assumptions, simplicity-first, surgical changes, goal-driven execution) that complements the mechanical structural rules in dt-backend-architecture. Apply when about to over-abstract, drive-by refactor, assume requirements silently, or start coding without verifiable success criteria.
license: MIT
---

# dt-backend Coding Discipline

> **다른 스킬과의 관계**
> - `dt-backend-architecture` = **기계적 구조 룰** (어느 레이어에 뭘 둘까, import 금지 등 — review가 정규식으로 자동 검출)
> - 본 skill = **판단 규율** (정규식으로 못 잡는, 사람/에이전트가 판단해야 하는 행동 원칙)
> - 검증: `dt-backend-review`가 본 skill의 항목들을 manual 체크로 참조

LLM 코딩의 흔한 실수를 줄이는 4가지 행동 원칙. [Andrej Karpathy의 관찰](https://github.com/multica-ai/andrej-karpathy-skills)에서 차용(MIT), dt-backend(NestJS + Prisma + PostgreSQL) 맥락으로 번역.

**트레이드오프:** 이 원칙들은 속도보다 신중함에 무게를 둔다. 사소한 작업은 판단껏.

---

## 1. Think Before Coding — 가정하지 말고 드러내라

구현 전에:
- 가정을 명시한다. 불확실하면 **묻는다.**
- **물을 수 없는 상황(자율 실행/서브에이전트)이면** 가정을 명시적으로 적고 가장 합당한 쪽으로 진행한다 — 조용히 고르지 않는다.
- 해석이 여럿이면 임의로 하나 고르지 말고 **제시한다.**

**예시 (엔드포인트 동작 모호):**
```
요청: "주문 목록 API 만들어줘"
❌ 임의 결정: 페이지네이션 방식(offset? cursor?)·정렬·기본 limit을 그냥 고름
✅ 질문: "커서 페이지네이션인가요? 기본 limit/정렬 기준은?"
   (물을 수 없으면: "cursor + limit 20 + 최신순으로 가정 — 다르면 알려주세요")
```
- 비즈니스 파라미터(limit/sort/필터)는 요청 계약(DTO/쿼리)에서 선언하지, Service가 임의 하드코딩하지 않음.

## 2. Simplicity First — 요청한 것만, 투기적 코드 없이

- 요청 범위 밖 기능 금지. **단일 용도 코드에 추상화 금지.**
- 요청 안 한 "유연성"/"설정 가능성" 금지. 일어날 수 없는 시나리오의 에러 처리 금지.

**스스로 물어라:** "시니어 개발자가 이거 과하다고 할까?" → 그렇다면 단순화.

```ts
// ❌ 과한 추상화 — CRUD 하나면 되는데 제네릭 레포 + 전략 주입
class BaseRepository<T> { constructor(private strategy: QueryStrategy<T>) {} /* ... */ }

// ✅ 필요한 것만 — 모듈별 명시적 Repository
@Injectable()
export class OrdersRepository {
  constructor(private readonly prisma: PrismaService) {}
  findById(id: string) { return this.prisma.order.findUnique({ where: { id } }); }
}
```
- Service도 옵션 객체로 분기 5개 만들지 말고, 실제 두 번째 유스케이스가 생길 때 메서드를 나눈다.

## 3. Surgical Changes — 건드릴 것만, 내 흔적만 치운다

기존 코드 수정 시:
- 인접 코드/주석/포맷팅을 "개선"하지 않는다. 안 망가진 걸 리팩토링하지 않는다.
- 내 취향과 달라도 **기존 스타일을 맞춘다.** 무관한 dead code는 **언급만 하고 지우지 않는다.**

**테스트: 변경된 모든 줄이 사용자 요청으로 직접 추적되는가?**

**dt-backend 적용:**
- 새 엔드포인트를 추가하다 옆 모듈의 무관한 코드를 발견해도 — 범위 밖이면 언급만.
- 새 에러 처리를 붙일 땐 같은 도메인의 기존 패턴(도메인 예외 throw → 전역 필터)을 따른다 — 새 패턴 발명 X.

## 4. Goal-Driven Execution — 검증 가능한 성공 기준을 정하고 루프

작업을 검증 가능한 목표로 변환:
- "검증 추가" → "잘못된 바디 → 400 테스트 작성 → 통과시키기"
- "버그 수정" → "버그 재현 통합 테스트(Supertest) 작성 → 통과시키기"

**예시 (모호한 버그 수정):**
```
요청: "댓글 삭제 고쳐줘"
❌ 약한 기준: "동작하게 만들기"
✅ 강한 기준: "최상위 댓글 삭제 시 대댓글까지 cascade 삭제, 타인 댓글 삭제 시도 → 403"
   → 그 시나리오를 재현하는 통합 테스트로 검증
```
- TDD 기본: RED(실패 테스트) → GREEN(최소 구현) → 검증. `dt-backend-testing`의 3계층 전략과 결합.

---

## Anti-Pattern 요약

| 원칙 | 안티패턴 | 교정 |
|---|---|---|
| Think Before | 페이지네이션/정렬/검증 규칙을 임의 가정 | 가정을 명시하고 모호하면 질문 |
| Simplicity | 단일 용도에 제네릭 레포/전략/옵션 객체 | 실제 두 번째 케이스 생길 때까지 명시적 구현 |
| Surgical | 버그 고치며 인접 코드·포맷·import 정리 | 요청에 직접 추적되는 줄만 변경 |
| Goal-Driven | "리뷰하고 개선하겠다" | "버그 X 재현 테스트 → 통과 → 회귀 없음 확인" |

## 핵심 통찰
과엔지니어링은 "명백히 틀린" 게 아니라 디자인 패턴을 **너무 일찍** 적용한 것이다. 타이밍 문제다.

**좋은 코드는 내일의 문제를 미리 푸는 게 아니라 오늘의 문제를 단순하게 푸는 코드다.**

## 활성화 조건
`.dt-backend.json`의 `enabledSkills`에 `dt-backend-coding-discipline`이 포함된 프로젝트에서 트리거됩니다. **파일이 없으면 `${CLAUDE_PLUGIN_ROOT}/docs/refs/stack-config-bootstrap.md` 절차로 만들고 계속합니다.**
