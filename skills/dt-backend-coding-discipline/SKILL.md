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

**원칙 본문은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/coding-discipline.md`가 원본이다 — 먼저 읽는다.** 4원칙(Think Before Coding · Simplicity First · Surgical Changes · Goal-Driven Execution)과 안티패턴 표는 그 문서에만 있다. 아래는 dt-backend(NestJS + Prisma + PostgreSQL) 맥락의 예시다.

## 1. Think Before Coding — 이 스택에서

```
요청: "주문 목록 API 만들어줘"
❌ 임의 결정: 페이지네이션 방식(offset? cursor?)·정렬·기본 limit을 그냥 고름
✅ 질문: "커서 페이지네이션인가요? 기본 limit/정렬 기준은?"
   (물을 수 없으면: "cursor + limit 20 + 최신순으로 가정 — 다르면 알려주세요")
```
- 비즈니스 파라미터(limit/sort/필터)는 요청 계약(DTO/쿼리)에서 선언하지, Service가 임의 하드코딩하지 않음.

## 2. Simplicity First — 이 스택에서

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

## 3. Surgical Changes — 이 스택에서

- 새 엔드포인트를 추가하다 옆 모듈의 무관한 코드를 발견해도 — 범위 밖이면 언급만(인접 코드 개선 금지).
- 새 에러 처리를 붙일 땐 같은 도메인의 기존 패턴(도메인 예외 throw → 전역 필터)을 따른다 — 새 패턴 발명 X.
- 주석 — WHAT 주석/포맷 드리프트 금지. 단, **내가 바꾼 비즈니스 규칙의 결정 로그를 갱신하는 것은 드리프트가 아니다** — `dt-backend-architecture` 주석 규칙이 요구하는 작업이다.

## 4. Goal-Driven Execution — 이 스택에서

- "검증 추가" → "잘못된 바디 → 400 테스트 작성 → 통과시키기"
- "버그 수정" → "버그 재현 통합 테스트(Supertest) 작성 → 통과시키기"

```
요청: "댓글 삭제 고쳐줘"
❌ 약한 기준: "동작하게 만들기"
✅ 강한 기준: "최상위 댓글 삭제 시 대댓글까지 cascade 삭제, 타인 댓글 삭제 시도 → 403"
   → 그 시나리오를 재현하는 통합 테스트로 검증
```
- `dt-backend-testing`의 3계층 전략과 결합.

## 활성화 조건

`.dt-backend.json`의 `enabledSkills`에 `dt-backend-coding-discipline`이 포함된 프로젝트에서 트리거됩니다. **파일이 없으면 `${CLAUDE_PLUGIN_ROOT}/docs/refs/stack-config-bootstrap.md` 절차로 만들고 계속합니다.**
