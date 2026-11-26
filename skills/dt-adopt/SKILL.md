---
name: dt-adopt
description: Use when bringing an existing (brownfield) project under dt management — "기존 프로젝트 들여오기", "이미 만든 프로젝트 스펙 뽑아줘", "ADR·결정 추출", or /dt-adopt. Detects stack, extracts screens/APIs/endpoints from code with evidence, asks intent-vs-bug questions, then has the standard spec authors write as-built specs (status draft, origin as-built), reverse-merges a definition, and proposes PD drafts. Nothing is finalized without human confirmation. Does not modify code.
user-invocable: false
---

# dt-adopt — 기존 프로젝트를 스펙·결정 기록으로 들이기

이미 만들어진 프로젝트를 플러그인 관리 체계(정의서·스펙·결정 기록·설정)로 들인다. 들인 뒤에는 새로 만든 프로젝트처럼 `/dt-implement`·`/dt-audit`·`/dt-e2e`가 그대로 돈다. **코드는 고치지 않는다.**

> 공용 정책 `${CLAUDE_PLUGIN_ROOT}/docs/orchestration-policy.md`(원칙 1~10)를 따른다. 산출물의 쓰는 쪽은 `${CLAUDE_PLUGIN_ROOT}/docs/refs/artifact-contract.md`.

## 입력
- 프로젝트 루트 하나(FE·BE가 한 저장소) 또는 `--fe <root> --be <root>`(저장소가 나뉨). 없으면 현재 폴더. 스택을 가리지 못하면 묻는다(원칙 10).
- 선택: `--scope <화면·리소스,…>` — 일부만 들일 때.

## 단계

### 1. 설정
- 스택 설정(`.dt-frontend.json`·`.dt-backend.json`)이 없으면 `${CLAUDE_PLUGIN_ROOT}/docs/refs/stack-config-bootstrap.md`로 만든다. 공통 설정 `.dt.json`이 없으면 `dt-wrap --init` 절차로 만들지 묻는다.
- `docs/project-context.md`가 이미 있는데 플러그인 형식이 아니면(플러그인 전부터 있던 문서·옛 단일 템플릿 — 제목·언어 무관) 덮어쓰지 않는다. `node "${CLAUDE_PLUGIN_ROOT}/scripts/projectContextSync.mjs" migrate --file docs/project-context.md --root <root>` 미리보기(옮김·겹침·코드에 없는 기술·대응 없는 절)를 4단계 질문과 함께 묻는다. 옮기기 전에는 스펙 작성 에이전트의 merge가 멈춘다(exit 3) — 같은 내용이 두 벌로 남거나 낡은 기록이 스펙 입력이 되지 않게.
- `${CLAUDE_PLUGIN_ROOT}/docs/refs/stack-precheck.md`로 **스택 사전 점검**. 기본 기술과 다른 영역의 답은 7단계 결정 후보에 합친다(따로 두 번 묻지 않는다).

### 2. 기계 추출
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/adopt/extract.mjs" <root>          # 또는 --fe <root> --be <root>
node "${CLAUDE_PLUGIN_ROOT}/scripts/handbook/analyze.mjs" <root>        # 구조(진입점·군집·데이터 주인·경계) — 핸드북과 같은 분석기
```
`.dt-adopt/extraction.json`에 화면·FE 호출·BE 엔드포인트(가드·상태 코드·근거)·FE↔BE 대조·수상한 점·결정 후보가 모인다. 결과를 한 줄로 보인다(예: "화면 4 · FE 호출 19 · 엔드포인트 23 · 확인 후보 3 · 결정 후보 4"). `notices`가 있으면 함께 보인다 — git이 아니면 출처가 날짜로만 남아 나중에 다시 들일 때 바뀐 곳을 비교할 수 없고, 커밋하지 않은 변경이 있으면 출처가 `-dirty`다. 막지는 않는다(커밋한 뒤 다시 뽑을지 한 줄로 묻는다).

### 3. 역추출 보강
`${CLAUDE_PLUGIN_ROOT}/agents/adopt-extractor.md`를 dispatch해 요청·응답 형태·예외·화면 요소·상태·네비게이션·업무 규칙을 채운다(근거·신뢰도 포함). 범위가 크면 리소스·화면 묶음별로 나눠 병렬로 부른다(원칙 1).

### 4. "의도인지 버그인지" 확인
기계 추출의 `suspects`와 워커의 needsDecision을 모아 **주제별로 묶어** 묻는다(원칙 6). 예:
- FE가 부르지 않는 엔드포인트(짝 없는 능력) — "화면 스펙이 빠졌다 / 다른 클라이언트용 / 죽은 API"
- 가드 없는 변경 API — "공개 API가 맞다 / 빠뜨렸다(버그)"
- BE에 없는 FE 호출 — "외부 서버 / BE에서 빠짐 / FE의 옛 경로"

"버그"로 답한 항목은 스펙에 **고친 동작**을 쓰고 완료 보고의 "코드 수정 과제"에 올린다. 현행 버그를 계약으로 굳히지 않는다.

### 5. 스펙 작성 — 기존 작성 에이전트가 쓴다
- BE: `dt-bespec-generate-spec` 흐름으로 `bespec-author`를 dispatch. 소스는 `as-built:.dt-adopt/extraction.json`(+ 4단계 답).
- FE: `dt-spec-generate-spec` 흐름으로 `spec-author`를 dispatch. 같은 소스.
- 둘 다 표준 형식 그대로 쓴다. 다른 점은 두 가지뿐이다:
  - 머리에 `<!-- origin: as-built @<ref> -->` — 코드에서 뽑은 스펙이라는 표시. ref는 `extraction.json`의 `origin.<stack>.ref`(커밋 sha · `<sha>-dirty` · `nogit-<날짜>`). 상태는 `status: draft`(새 상태값을 만들지 않는다 — 머리 주석 형식은 `finalized|draft`뿐).
  - 코드에서 읽은 FR은 출처 라벨 `[inferred]`, 4단계에서 사람이 확인한 것은 `[user-resolved]`.
- 형식 검사(`scripts/validateSpec.mjs`)를 통과해야 한다(작성 에이전트의 게이트).

### 6. 정의서 — 역합치
`dt-devspec` 흐름으로 `definition-author`를 dispatch한다. 소스는 방금 쓴 leaf 스펙(정의서 작성의 §1-b 역합치 — `discoverLeafSpecs`). FE 호출 ↔ BE 엔드포인트 대조 결과가 IF 후보의 근거다. 결과 `docs/specs/definition.md`는 `status: draft`.

### 6.5 스펙을 정의서에 결속
**정의서의 §3 협의를 끝내고 버전이 정해진 뒤에** 한다 — 협의 반영으로 정의서 버전이 오르면(`definitionVersion.mjs`), 먼저 결속한 스펙은 시작부터 stale이 된다(검증 실행에서 병렬로 돌렸다가 실제로 겪음). 5단계 스펙은 정의서가 없을 때 썼으므로(standalone) 아직 IF를 가리키지 않는다. 정의서 작성 에이전트가 돌려준 IF 매핑(엔드포인트 → IF-n)을 들고 **bespec-author·spec-author를 다시 dispatch**해 자기 스펙에 결속시킨다(산출물의 쓰는 쪽은 그 에이전트다 — 조율자가 직접 고치지 않는다).
- 머리 `basedOnDefinition: <경로>@v<N> | IF-…`(buildSpecHeader), api-contract 행, 그리고 **requirements.md의 FR 줄**마다 `<!-- from: IF-n -->`(FE도 — design 표에만 달면 FR 단위 영향 산출이 안 된다. 형식 검사 `fr-from-missing` 경고 0이 조건).
- 결속 뒤 `scripts/checkDefinitionDrift.mjs`가 0이어야 한다. 결속 전에는 모든 엔드포인트가 "IF 없는 새 엔드포인트"로 잡히는 것이 정상이다(실제 프로젝트 검증에서 확인).
- **결속 뒤 정의서 버전만 다시 올랐으면 에이전트를 부르지 않는다.** 드리프트 검사가 0이면 조율자가 파일마다 `node "${CLAUDE_PLUGIN_ROOT}/scripts/buildSpecHeader.mjs" --replace <파일> --definition <정의서 상대경로>@v<N>`만 돌린다(`docs/refs/spec-pipeline.md` §5-5). 드리프트가 남을 때만 작성 에이전트를 다시 dispatch한다.

### 7. 결정 후보 → PD 초안
`extraction.json`의 `decisionCandidates`(스택·데이터 모델·API·커밋 근거)를 주제별로 보이고 "PD로 남길까요?"를 묶어 묻는다. 고른 것만 `dt-decision` new 절차로 쓴다 — 스택 후보는 머리 `topic`(`stack.*`)을 그대로 적는다(다음 사전 점검이 다시 묻지 않게). 근거가 `guess`인 후보는 기본값을 "남기지 않음"으로 둔다. 바뀔 가능성이 큰 결정(예: 페이지네이션 없음)은 `expires`를 단다.
- **FE·BE가 다른 저장소면** PD는 정의서가 있는 저장소의 `docs/decisions/`에 한 벌로 둔다(번호가 하나로 이어져야 정의서가 `근거: PD-NNN`으로 가리킬 수 있다). 다른 저장소의 `.dt.json`에 `"decisions": { "sharedDir": "<정의서 저장소까지 상대 경로>/docs/decisions" }`를 넣자고 제안한다 — 그래야 그 저장소에서 단독으로 도는 리뷰(override 근거)·스택 사전 점검·`/dt-decision`이 같은 PD를 본다(`docs/refs/config-schema.md`).

### 8. 사람 확인 → 확정
단위(리소스·화면)별로 스펙 경로와 가정 목록(`assumptions`)을 보이고 확인받는다. 확인한 단위만 `status: finalized`로 올린다(형식 검사 오류 0 · 정의서 정합 드리프트 0이 조건). PD는 `accepted`로. 확인하지 않은 단위는 draft로 남고, 다음 `/dt-adopt --scope`로 이어 갈 수 있다.

### 9. 마무리
- 보고: 들인 리소스·화면 수, 확정/draft, PD 수, **코드 수정 과제**(4단계 "버그"), 남은 수상한 점.
- 다음 단계 제안: `/dt-audit`(방금 뽑은 스펙과 코드가 맞는지 — 이 시점이면 깨끗해야 정상) · `/dt-e2e`·`/dt-be-e2e`(확정 스펙으로 수용 테스트).

## 활성화 조건
기존 코드는 있는데 `docs/specs/`가 비었거나 일부만 있을 때, 또는 `/dt-adopt`. 새 프로젝트는 `/dt-fullstack`.

## 안 하는 것
- 코드 수정(진단·스펙화만) · 사람 확인 없이 확정 · 현행 버그를 스펙으로 굳히기 · 스펙 형식을 따로 만들기(표준 작성 에이전트가 쓴다).
