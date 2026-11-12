# dt-audit — 스펙↔구현 정합 감사 리포트 설계

> 상태: 설계(design) · 작성일 2026-07-24
> 선행: dt-devspec(정의서 SOT)·dt-spec/dt-bespec(leaf 스펙)·dt-implement/dt-be-implement(구현) — dt-audit은 이 파이프라인의 **사후 감사 계층**
> 방법론 차용: [github/spec-kit](https://github.com/github/spec-kit) `/speckit.converge`(123k★ — 인텐트 인벤토리·gap 분류·findings 테이블), [sandeco/reversa](https://github.com/sandeco/reversa)(1.4k★ — 신뢰도 라벨·traceability·읽기 전용 보증), [blader/schematic](https://github.com/blader/schematic)(병렬 탐색+간극 교차검증)

## 1. 목표

구현된 애플리케이션(정적 코드 + 실행 중인 앱)을 분석해 as-built 스펙을 역추출하고, 내부 정의된 dt 스펙 산출물(`docs/specs/definition.md` + `pages/<page>/` + `resources/<resource>/`) 대비 **무엇이 미충족·불일치·미반영·미문서화**인지 UX·FE·BE·크로스스택 관점에서 판정하여, 개발팀이 바로 액션할 수 있는 감사 리포트를 산출한다.

핵심 결정(사용자 협의):
- **비교 기준 = dt 스펙 산출물** (외부 문서 파싱은 범위 밖).
- **분석 대상 = 코드 + 실행 앱** — 정적 분석에 더해 Playwright MCP로 실행 앱을 순회하며 UX까지 감사.
- **독자 = 개발팀 액션용** — 파일/IF/FR-ID 단위 액션 지향 리포트(Markdown, `docs/audits/`).
- **범위 = 전체 기본 + 부분 지정 가능** — `--scope fe|be|ux`, `--page <p>`, `--resource <r>`.
- **드리프트 감지 포함** — "스펙은 갱신됐는데 코드가 안 따라온" 케이스를 git 이력으로 세밀 판정(spec-kit converge가 명시적으로 안 하는 것 = 이 스킬의 고유 가치).
- **아키텍처 = 얇은 조율자 + 격리 감사 워커** (orchestration-policy 원칙 1·2·4 준수). spec-kit converge 방법론을 골격으로, Reversa의 신뢰도·traceability를 얹음.
- **범위는 스킬 구현까지** — sample-web 도그푸딩은 별도 회차(dt-be-e2e 관례). 도그푸딩 발견 이슈는 플러그인 추상화로만 반영.

## 2. dt-review와의 경계 (겹침 방지)

| | dt-review/dt-be-review | **dt-audit** |
|---|---|---|
| 질문 | "코드가 **아키텍처 룰**을 지키나?" | "코드가 **스펙**을 충족하나?" |
| 기준 | patterns frontmatter (레이어 룰) | dt 스펙 산출물 (FR/IF/AC) |
| 방식 | review.mjs 기계 검사 | 역추출 → 스펙 diff → git 드리프트 |
| 산출 | verdict (PASS/NEEDS_REPAIR) | 감사 리포트 (findings + traceability) |

dt-audit은 아키텍처 룰 위반을 재검사하지 않는다(dt-review 소관 — 중복 보고 금지).

## 3. 구성물

```
plugin/
  commands/dt-audit.md                 # /dt-audit 진입점
  skills/dt-audit/SKILL.md             # 얇은 조율자 본문
  skills/dt-audit/references/          # findings 스키마·리포트 템플릿·드리프트 판정 상세
  agents/auditor.md                    # 격리 감사 워커 (track: fe|be|ux 파라미터 — reviewer.md 통합 관례)
```

워커는 3트랙을 하나의 에이전트 정의로 통합하고 `track` 파라미터로 분기한다(reviewer.md가 FE/BE를 stack 파라미터로 통합한 관례). 공통 3단계(역추출→diff→판정)가 동일하고 트랙별 소스·기준만 다르기 때문.

## 4. 실행 흐름 (조율자 — SKILL.md)

### §0 게이트
- 스펙 산출물 존재 확인: `docs/specs/definition.md`(있으면), `pages/*/requirements.md`, `resources/*/api-contract.md` 인벤토리를 수집. **leaf 스펙이 하나도 없으면 중단** — "감사할 기준 스펙이 없습니다. /dt-spec·/dt-be-spec을 먼저 실행하세요" 안내(as-built 추출만 단독 수행은 범위 밖 — YAGNI).
- 프로젝트 루트 판별: `.dt-frontend.json` / `.dt-backend.json` 마커로 FE/BE 프로젝트 경로 자동 탐지(모노레포 대응). 못 찾으면 사용자에게 1회 질문.
- `--app-url` 없고 ux 트랙 요청 시: 실행 중인 앱 접근 확인(fetch 1회). 실패하면 **ux 트랙만 skip**하고 리포트에 "UX 감사 미수행(앱 미기동)" 명시 — 전체 실패로 만들지 않는다.

### §1 모드 확인 + dispatch (원칙 1 — 1회 확인)
- 대상 트랙 결정: `--scope` 없으면 스펙·마커 존재 기반으로 자동(FE 스펙+마커 있으면 fe, BE 스펙+마커 있으면 be, 앱 접근되면 ux).
- AskUserQuestion 1회(원칙 1 템플릿): "감사는 N개 트랙으로 나뉩니다(추천: 병렬 — 트랙 간 쓰기 충돌 없음/읽기 전용). 병렬(추천)/순차/자동".
- 트랙별 `auditor` 워커 dispatch. 전달 계약:
  ```
  { track: fe|be|ux,
    specInventory: [스펙 파일 경로들 — §0 수집분],
    projectRoot: <해당 스택 프로젝트 루트>,
    scopeFilter: { pages?: [], resources?: [] },     # 부분 감사
    appUrl?: <ux 트랙>,
    priorTraceability?: docs/audits/<최근>/traceability.md,  # 증분 감사 시드
    runDir: docs/audits/YYYY-MM-DD-<scope>/ }        # 산출 폴더 — ux evidence 저장 위치
  ```

### §2 병합 + 크로스스택 판정 (조율자 직접 — 유일한 분석 작업)
워커들이 반환한 findings를 병합하고, 단일 트랙이 못 잡는 크로스스택 finding만 조율자가 직접 판정한다:
- **FE 호출면 ↔ BE 표면 대조**: fe 트랙 워커가 반환한 "FE가 실제 호출하는 API 목록"과 be 트랙 워커의 "BE가 실제 노출하는 엔드포인트 목록"을 IF-ID 기준으로 조인 — 한쪽에만 있으면 `mismatch`(양쪽 스펙엔 있는데 배선이 어긋난 경우) 또는 `missing`.
- **정의서 체인 드리프트**: `basedOnDefinition@vN` 마커의 isStale 판정 결과(워커가 수집)를 묶어 "정의서→leaf 스펙→코드" 2단 드리프트 체인으로 승격 보고.
- 중복 제거: 같은 sourceRef+파일에 대한 트랙 간 중복 finding은 근거를 병합해 1건으로.

### §3 리포트 산출
`docs/audits/YYYY-MM-DD-<scope>/`에 산출(쓰기는 이 폴더로만 — §8):
- `report.md` — 본 리포트(§7 형식)
- `traceability.md` — 스펙ID ↔ 구현 파일 매핑 표(다음 증분 감사의 시드)

finding 0건이면 spec-kit converge 관례대로 **"✅ Converged — 구현이 스펙을 충족합니다"** + 검사한 항목 수만 보고(빈 리포트 파일은 생성하되 findings 섹션에 클린 명시).

산출 후 후속 안내(자동 실행 금지): 코드 수정 액션은 /dt-implement·/dt-be-implement 재실행 또는 수동 수정, 스펙 갱신 액션은 /dt-spec·/dt-be-spec·/dt-devspec 재실행을 권고.

## 5. 워커 방법론 (agents/auditor.md — 3단계 공통)

### 5.1 인텐트 인벤토리 + code-scope map (spec-kit converge §3 차용)
스펙에서 **안정 키를 가진 검사 단위**를 뽑는다:
- **fe**: `pages/<page>/requirements.md`의 FR-###(EARS) + `layout-skeleton.md`의 구조 노드 + `interactions.md`의 액션→리액션 항목
- **be**: `resources/<resource>/api-contract.md`의 엔드포인트×상태코드 행(+ `<!-- from: IF-n -->` 역참조) + requirements.md EARS
- **ux**: fe와 같은 소스에서 **런타임 관찰 가능 항목만** 필터(화면 존재·네비게이션·로딩/빈/에러 상태·인터랙션 반응)

각 검사 단위마다 code-scope map을 도출: 스펙이 명명한 파일 경로 + 키워드 탐색으로 해당 단위를 구현하는 파일 집합을 한정. **감사 범위는 이 map으로 바운드** — 스펙이 정의하지 않은 영역으로 추론 확장 금지(토큰 가드이자 오탐 가드).

### 5.2 as-built 역추출 + diff
- **fe**: 라우트 정의→페이지 목록, 페이지별 5레이어에서 API 호출면(services)·상태(store)·화면 요소(view) 역추출 → 검사 단위별 대조. 부수 산출: "FE가 실제 호출하는 API 목록"(§2 크로스스택용).
- **be**: 컨트롤러 데코레이터→엔드포인트 표면, DTO→요청/응답 shape, 예외 필터/가드→상태코드 역추출 → api-contract 행별 대조. 부수 산출: "BE가 실제 노출하는 엔드포인트 목록".
- **ux**: Playwright MCP로 스펙의 페이지 순서대로 순회 — 각 화면 snapshot으로 layout-skeleton 구조 노드 존재 확인, interactions.md의 액션 실행→리액션 관찰(클릭→이동, 로딩/빈/에러 상태 재현). 코드로 못 잡는 "요소는 있는데 동작 안 함"을 잡는다. 스크린샷은 `docs/audits/<run>/evidence/`에 저장해 evidence로 링크.

### 5.3 드리프트 판정 (git 축 — 이 스킬 고유)
diff만으로는 "원래부터 미구현(missing)"과 "스펙이 나중에 바뀌었는데 코드 미반영(drift)"을 구분 못 한다. 구분 절차:
1. 검사 단위가 속한 스펙 섹션의 마지막 수정 커밋을 `git log -L`(행 범위) 또는 스펙 파일 단위 `git log -1`로 확보.
2. code-scope map의 파일들의 마지막 수정 시점과 대조.
3. **스펙 변경이 코드 변경보다 나중**이고 그 이후 해당 파일들에 커밋이 없으면 → gapType을 `drift`로 승격 + 근거로 스펙 diff 요약(`git log -p` 해당 구간)을 evidence에 첨부.
4. `basedOnDefinition@vN` 마커 isStale이면 leaf 스펙 자체가 낡은 것 — 이 경우 코드 감사 결과에 "기준 스펙 자체가 정의서 대비 stale(v차이)" 플래그를 달아 §2 체인 보고로 올린다(낡은 스펙 기준 판정을 확정으로 팔지 않기 위함).

git 이력이 없거나 얕으면(shallow clone 등) drift 축은 skip하고 리포트에 명시.

### 5.4 반환 계약 (워커 → 조율자)
```
{ track,
  findings: [Finding...],          # §6 스키마
  surface: {...},                  # 크로스스택용 (fe: 호출 API 목록 / be: 노출 엔드포인트 목록)
  traceability: [ {sourceRef, files[]} ],
  checked: { units: N, skipped: [사유] },
  staleSpecs: [ {spec, basedOn, currentVersion} ] }
```
원자료(코드 본문·snapshot 전문)는 워커 컨텍스트에 격리 — 조율자에겐 위 구조만.

## 6. Finding 스키마

```
{ id: A-###,                       # 리포트 내 안정 키
  track: fe|be|ux|cross,
  gapType: missing | partial | mismatch | drift | undocumented | improvement,
  severity: CRITICAL | HIGH | MEDIUM | LOW,
  confidence: 🟢 confirmed | 🟡 inferred | 🔴 needs-human,
  sourceRef: FR-3 | IF-7 | "GET /posts×401" | US1/AC2 | (undocumented는 코드 측 참조),
  evidence: 파일:라인 | 스크린샷 경로 | git 커밋 근거,
  action: code-fix | spec-update | confirm,
  description: 무엇이 어떻게 다른지 1-3문장 + 권장 조치 }
```

gapType 어휘(spec-kit 4분류 + 자체 2분류):
- `missing` — 스펙에 있는데 구현에 전혀 없음 *(spec-kit)*
- `partial` — 구현은 있는데 요구를 불완전 충족 *(spec-kit)*
- `mismatch` — 구현이 스펙과 상충(spec-kit의 `contradicts`)
- `drift` — 스펙이 코드보다 나중에 갱신됐는데 미반영 (git 근거 필수) *(자체)*
- `undocumented` — 구현에 있는데 스펙에 없음(spec-kit의 `unrequested` — action은 spec-update 또는 confirm) *(역방향)*
- `improvement` — 정합하지만 개선 여지(UX 관례·에러 처리 등. LOW 고정, 남발 금지: 스펙이 침묵하는 영역에서 사용자 가치가 분명한 것만) *(자체)*

severity 기준(spec-kit §5 차용): CRITICAL = 핵심 사용자 스토리의 기본 동작을 막는 missing/mismatch/drift · HIGH = 핵심 FR/IF/AC의 missing/partial/drift · MEDIUM = 부차 요구의 partial, 사유 불명 undocumented · LOW = 사소한 partial·improvement.

confidence(Reversa 차용): 🟢 코드/화면에서 직접 확인 · 🟡 패턴 추론 · 🔴 사람 판단 필요. **🔴은 findings 본문이 아니라 리포트의 "확인 필요" 섹션에 격리** — 오탐을 단정 보고하지 않는다.

## 7. 리포트 형식 (report.md)

1. **헤더** — 감사 일시·범위·기준 스펙 버전(definitionVersion 포함)·검사 단위 수·트랙별 수행/미수행(사유)
2. **요약 매트릭스** — 페이지/리소스 × gapType 건수 + severity 분포 (한눈 파악)
3. **Findings** — severity 내림차순 테이블: `ID | Track | Gap | Sev | Conf | Source | Evidence | 권장 액션`. 각 행 아래 description 상세. **action별 소계**(코드 수정 N건 / 스펙 갱신 N건)를 끝에 — 액션이 양방향임을 드러낸다.
4. **확인 필요 (🔴)** — 사람 판단이 필요한 항목을 질문 형태로 모음
5. **드리프트 체인** — 정의서→스펙→코드 2단 낡음이 있으면 별도 섹션
6. **Traceability 부록** — traceability.md 링크 + 하이라이트

## 8. 불변 원칙

1. **읽기 전용 감사.** 쓰기는 `docs/audits/<run>/`로만. 코드·스펙·tasks를 절대 수정하지 않는다(Reversa 보증 차용, spec-kit converge의 append-only보다 보수적 — 수정 액션은 리포트 권고로만).
2. **스펙이 정의한 범위로 바운드.** code-scope map 밖 추론 확장 금지. 단 `undocumented` 탐지를 위해 **표면 스캔**(라우트 목록·컨트롤러 목록 등 표면 인벤토리)만 전역 허용 — 본문 deep-read는 map 안에서만.
3. **원자료 격리.** 코드 본문·snapshot·git diff 전문은 워커 컨텍스트에 가두고 조율자는 §5.4 계약만 수신.
4. **아키텍처 룰 재검사 금지.** dt-review 소관과 중복 보고하지 않는다(§2 경계).
5. **낡은 기준으로 확정 판정 금지.** 기준 스펙이 isStale이면 해당 findings에 stale 플래그를 병기한다.

## 9. 증분 감사

재실행 시 `docs/audits/` 최신 run의 traceability.md를 워커 시드로 전달 — code-scope map 구축을 단축하고, 이전 findings와 id 매칭해 리포트에 `해결됨/잔존/신규` 상태를 병기한다(수렴 루프: 재실행할수록 잔존이 줄어드는 spec-kit converge 관례).

## 10. 실행 모드

- **dispatched(기본)**: §4 구조. `--scope fe`면 fe 워커만.
- **inline degrade(원칙 4)**: 서브에이전트 미지원 시 조율자가 §5 절차를 트랙 순차로 직접 수행, 1줄 고지. 같은 절차·같은 산출.

## 11. 커맨드

```
/dt-audit [--scope fe|be|ux|all] [--page <p>] [--resource <r>] [--app-url <url>]
```
- 무인자 = 자동 트랙 판별 전체 감사.
- 트리거 어휘: "스펙 감사", "구현이 스펙대로 됐는지", "스펙 드리프트 찾아줘", "/dt-audit".

## 12. 테스트 전략

- 스킬 문서 검증: plugin/tests의 기존 스킬 검증 관례(구성물 존재·frontmatter 스키마) 준수.
- 방법론 검증은 sample-web/sample-api 도그푸딩 별도 회차에서 — 의도 심은 드리프트(스펙만 수정) 1건·미구현 FR 1건·undocumented 엔드포인트 1건을 시드로 넣고 리포트가 3건 모두 올바른 gapType으로 잡는지 확인하는 시나리오를 그 회차 수용 기준으로 한다.
