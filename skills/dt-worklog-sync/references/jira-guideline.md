# ACME JIRA 가이드라인 룰셋 (dt-worklog-sync 참조)

출처: 사내 "JIRA 사용자 가이드라인 v1.0". 스킬은 이 룰을 강제한다.

## 이슈 타입 (Epic은 스킬이 생성하지 않음 — QA팀 관리)
- 스토리(Story): 화면 단위 디자인/개발. 시작·종료일 필수.
- 작업(Task): 화면 외 협업 업무. 시작·종료일 필수.
- 버그(Bug): 기능 결함. 시작·종료일 불필요. 제한 전이.
- 하위 작업(Sub-task): 개인 실제 업무 단위. 시작·종료일 불필요. **실무자의 기본 단위.**

## 강제 룰
1. 실무자는 Sub-task 기준으로 일한다 → 기본 생성 단위 = Sub-task (부모 Story/Task 필요).
2. Sub-task 크기 = 1일(최대 3일). Todo 수준 과세분화 금지.
   - O 예시: "로그인 기능 설계", "홈 화면 구현"
   - X 예시: "버튼 색상 변경", "비밀번호 오류 문구 수정", "로그 확인" → 개별 이슈로 만들지 않음
3. 3일 초과 → 동일 이름 "(1)", "(2)" 차수 분리.
4. 담당자(Assignee) 필수 — 비워두지 않음. 기본값 = 인증된 나.
5. 담당자별로 Sub-task 분리 — 내 작업만 내 Sub-task로.
6. 구두/메신저 요청도 Jira 등록 (수동 메모 소스).
7. **Sub-task 완료(Done) 시 산출물 링크(커밋/MR/테스트결과) 필수.** 추적 불가 이슈는 Done 금지.
8. 진행 상황에 맞춰 Status 즉시 업데이트.

## 상태(Status) 워크플로우
- Sub-task: Backlog → Todo → In Progress → (Resolved/Feedback) → Done
- Story: 파트별 — UX 진행/완료, GUI 진행/완료, **개발 진행/개발 완료**, QA 진행/완료, Done
- Bug: Backlog → Open → Assign → In Progress → Integration → Deployed → Verified → Done
  - Rejected → (QA) Closed / Reopened → 담당자 재지정 후 Assign부터
  - **Deployed 전이 시 해결 방법을 댓글로 필수 기록**
  - **Verified 전이 시 검증 방법을 댓글로 필수 기록**

## 컴포넌트
UX / Visual / Dev / Interaction — 작업 파트 구분. FE/BE 개발 작업은 보통 **Dev**.

## 이슈 유형 결정 (FAQ 3 — 부모 생성 시 적용)
- **화면 단위 디자인/개발** → **Story** (예: "A 화면", "기능 A API 구현")
- **화면 외 협업/일반 개발 작업** → **Task** (예: 요구사항 분석, 설계, 인프라, 배포, 변경 이력)
- 디자인/개발 기능의 **결함** → **Bug**
- 개인이 수행할 **실제 업무 단위** → **Sub-task** (Story/Task/Bug 아래)

## Epic 구조 (QA 제공 — 스킬은 생성하지 않음)
QA팀이 Space 생성 시 기본 Epic을 만들어 둔다: **관리 / 수행 / 검수 / 변경 이력 / 배포 및 오픈**.
개발 작업의 Story/Task는 보통 **`수행` Epic**(BE는 "수행 (BE)") 아래에 둔다. 운영/변경은 `변경 이력`, 배포 작업은 `배포 및 오픈`.

## Story 공유 규칙
스토리는 **화면 기준으로 프로젝트 참여 인원이 함께 쓰는** 유형이다. **같은 화면의 Story를 UX·GUI·개발용으로 따로 만들지 않는다.** 이미 그 화면 Story가 있으면 개발 Sub-task를 그 아래에 단다(개발 진행/개발 완료는 Story의 파트별 상태로 표현).

## 개발(Dev) 파트 사례 (PDF — 부모 타입 판단 참고)
**Task 유형(화면 외 개발 작업)** + 하위 Sub-task 예:
- 요구사항 분석 → 기획서 분석
- 설계 → FE 설계 / API 설계 / DB 스키마 설계 / 공통 컴포넌트 구현
- 인프라 구성 → 인프라 설계 / 인프라 구성
- 배포 및 오픈 → 배포
- 변경 이력 → "YY-MM-DD 고객사 기능 변경 요청" → A1 API 수정

**Story 유형(화면/기능 단위 개발)** + 하위 Sub-task 예:
- A 화면 / B 화면 → 세부 화면 구현
- (BE) 기능 A API 구현 → A1 API 구현 / A2 API 구현

## 담당자 (FAQ 5)
담당자는 비워두지 않는다. 미정이면 PM/PL이 임시 담당 후 확정 시 변경 — **단, 본 스킬은 항상 인증된 나를 담당자로 둔다**(내 개발 작업 동기화 전용).

## 본 스킬의 적용 범위 (개발자)
위 룰 중 **개발자가 자기 작업을 Sub-task로 기록**하는 데 필요한 부분만 강제한다. 디자인(UX/Visual) Story·Sub-task, QA의 Bug 검증(Verified/Closed)·결함 판정, PM의 Epic/전체 Story 관리는 본 스킬 범위 밖이다(다른 역할 가이드).
