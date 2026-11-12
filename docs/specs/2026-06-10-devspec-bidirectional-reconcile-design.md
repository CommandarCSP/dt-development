# 설계: 정의서 양방향 정합 — 스크린 deep-read + 상향 정합 + 협의중/확정 (A+B+C)

> 대상: `dt-devspec` / `dt-spec-generate-spec` / `dt-bespec-generate-spec` / `scripts/definitionPropagation.mjs`
> 상위: [dev-definition-sot-design](2026-06-09-dev-definition-sot-design.md) 의 후속 결함 수정

## 1. 배경 & 문제

dt-devspec 파이프라인에서 **list/검색 엔드포인트의 필터/정렬/쿼리 파라미터가 구조적으로 유실**된다. 근본 원인은 맞물린 세 결함이다.

- **결함 A — 계약 정의 단계가 계약 디테일을 못 읽음.** dt-devspec은 IF(인터페이스 합의)의 요청 계약(쿼리)을 책임지는데(불변원칙 2), 불변원칙 1이 `get_metadata`만 허용한다. 그런데 필터·정렬 규칙은 화면 주석 패널에 있고 `get_metadata`로는 placeholder만 나온다.
- **결함 B — 깊이 읽는 단계가 위로 되돌릴 통로가 없음.** dt-spec/dt-bespec은 `get_design_context`로 주석을 실제로 읽지만, §0 게이트가 "확정값으로 인용, 재추론 금지"만 규정해 발견한 누락을 정의서로 못 올린다. `definitionPropagation`은 정의서→스펙 단방향뿐.
- **결함 C — "협의중을 확정값으로 인용"하라는 자기모순.** 정의서 IF는 합의 상태가 협의중인데 §0 게이트는 그걸 확정값으로 인용하라 한다. 보강이 필요한 IF가 보강 없이 굳는다.

### 실증 (2026-06-10, fileKey `yHgWsY6I3Dk5J2223QRCWb`, SCR_FLE_01 `14:7347`)

같은 노드 `519:14641`을 두 도구로 호출한 결과:

| 텍스트 노드 | `get_metadata`의 `name` | `get_design_context`의 실제 본문 |
|---|---|---|
| 519:14653 | `Description` | "해당 파일을 다운로드 받는다." |
| 519:14674 | `Description` | "선택 파일 압축 다운로드 → 비동기 백엔드 압축 후 메일 발송… toast" |
| **861:46544** | **`Description`** | **"해당 컬럼을 기준으로 오름차순/내림차순 토글" ← 정렬 규칙** |

`get_metadata`는 주석 텍스트 노드 6개를 전부 `Description` placeholder로만 반환 → dt-devspec이 정렬 규칙을 못 읽음 → IF-18 files가 `keyword`만 남음. **결함 A 실증 완료.** (주석 패널은 `Row > Header/Description` 슬롯으로 컴포넌트화되어 레이어 `name`이 본문과 무관하게 고정됨이 원인.)

## 2. 목표 & 비목표

**목표**
- list/검색 엔드포인트의 필터·정렬·쿼리 파라미터가 형제 IF 간 들쭉날쭉하지 않게 안정적으로 포착된다.
- dt-devspec이 못 읽은 디테일을 leaf(dt-spec/dt-bespec)가 발견하면 정의서로 되돌릴 수 있다.
- "협의중 IF는 보강 가능, 확정 IF만 lock"으로 의미를 일관시킨다.

**비목표**
- Figma 주석 패널의 완벽 자동 식별(레이어 name 불안정 → 식별 대신 스크린 단위 deep-read로 우회).
- 정의서 자동 덮어쓰기(모든 정의서 변경은 사용자 확인).
- get_design_context의 무분별한 전체/반복 호출(대상 스크린당 1회로 상한).

## 3. 핵심 결정

| ID | 결정 |
|---|---|
| A | **스크린 단위 deep-read** — name·위치로 주석을 식별하지 않고, 대상 스크린 프레임을 `get_design_context`로 1회 통째 읽어 규칙 전문을 확보. 불변원칙 1을 "발견은 경량, 계약은 타깃 깊이"로 완화. (※ 후속 [2026-06-11 설계](2026-06-11-devspec-deepread-right-annotation-targeting-design.md)에서 *우측 주석 영역만 position으로 타깃*하도록 개선 — 통째는 폴백으로.) |
| C | **협의중/확정 의미 정리** — 확정 IF는 lock(그대로 인용), 협의중 IF는 leaf가 deep-read로 보강·구체화 가능. "협의중을 확정값으로 인용" 모순 제거. |
| B | **상향 정합 게이트** — leaf가 deep-read 계약 ↔ 인용 IF를 diff, 드리프트 발견 시 리포트(게이트=필수) + 정의서 보강 제안(사용자 확인 후 반영). `definitionPropagation` 양방향화. |

## 4. A — dt-devspec 스크린 단위 deep-read

**`dt-devspec/SKILL.md` 변경**

흐름 §1 (현재 "경량 수집·스캔"):
```
### 1. 발견 + 타깃 deep-read
- 각 Figma 페이지: `get_metadata`에 페이지 노드(예 0:1)를 줘 스크린 프레임 트리를 발견(경량). prefix는 환경의 dt-spec-analyze-figma를 따름.
- 발견된 각 **대상 스크린**(데이터 흐름·IF 후보가 있는 화면): `get_design_context`로 **1회** deep-read → 주석/규칙 텍스트 전문 확보(name·위치 무관 → 견고).
- 순수 정적·비데이터 스크린(IF 후보 없음)은 metadata로 충분 → deep-read 스킵.
```

불변원칙 1 (현재 "경량 스캔만. get_design_context는 호출하지 않는다"):
```
1. **발견은 경량, 계약은 타깃 깊이.** 페이지 구조 발견은 `get_metadata`(경량). 단 IF 계약(쿼리/필터/정렬)은 주석에 있고 metadata로는 `Description` placeholder만 나오므로, **대상 스크린은 `get_design_context`로 1회 deep-read**한다. 무분별한 전체/반복 deep-read는 금지(대상 스크린당 1회, 정적 스크린 스킵).
```

→ dt-devspec이 IF-18 같은 규칙(정렬/필터)을 처음부터 읽어 정의서 IF에 반영. **결함 A 직접 해소.**

## 5. C — 협의중 ↔ 확정 의미 정리

**`dt-spec-generate-spec/SKILL.md` + `dt-bespec-generate-spec/SKILL.md` §0 게이트 변경 (FE/BE 대칭)**

현재: "정의서의 IF-n을 확정값으로 인용한다."
변경:
```
- 정의서 IF의 **합의 상태**에 따라:
  - **확정(agreed) IF** → lock. 그대로 인용한다. 재추론·임의 변경 금지.
  - **협의중(tentative) IF** → leaf가 deep-read로 **보강·구체화 가능**(잠정 계약이므로). 보강 결과는 §B 상향 정합으로 정의서에 환류.
```

- 정의서 IF 표의 "합의 상태" 컬럼(확정 | 협의중)을 leaf가 읽어 분기.
- `validateDefinition`은 합의 상태 값 집합(`확정`/`협의중`)만 느슨 검증(과도 강제 없음).

## 6. B — 상향 정합 게이트 (leaf → 정의서)

**`dt-spec-generate-spec/SKILL.md` + `dt-bespec-generate-spec/SKILL.md`에 상향 정합 단계 추가**

```
## 상향 정합 (deep-read ↔ 정의서 IF diff) — 게이트
산출 직전, deep-read로 얻은 실제 요청/응답 계약을 인용한 정의서 IF와 diff한다.
1. `definitionPropagation.detectDrift(definitionIF, deepReadContract)`로 구조적 차이(파라미터 키 집합·메서드·상태코드)를 추출.
2. 의미적 차이(필터/정렬 규칙이 IF에 누락 등)는 deep-read 텍스트를 근거로 판단.
3. 드리프트가 있으면 **반드시 "정의서 드리프트 리포트"를 산출**(게이트=필수, 침묵 금지):
   - 어느 IF가 무엇을 누락/모순하는지 + deep-read 근거(주석 인용).
4. 정의서 보강을 **제안**: 협의중 IF면 보강안 제시 → 사용자 확인 후 정의서에 반영(확정 승격 가능). 확정 IF와 모순이면 충돌로 표시(자동 변경 금지).
※ 자동 덮어쓰기 금지 — 리포트·제안은 필수, 정의서 반영은 사용자 확인 후.
```

**`scripts/definitionPropagation.mjs` 양방향화**

- 기존(정의서→스펙, 유지): `isStale` / `extractBasedOnDefinition` / `extractFromRefs` / `computeImpacted`.
- 신규(스펙→정의서): `detectDrift(definitionIF, deepReadContract)` → `{ missing: string[], conflicting: string[] }`.
  - 구조적 비교만 담당(요청 파라미터 키 집합 diff, 메서드/상태코드 불일치). 의미 판단은 SKILL이 deep-read 텍스트로 수행.
  - 순수 함수, 부수효과 없음. 테스트 가능.

## 7. 통합 흐름

```
dt-devspec (A: 스크린 deep-read) ─→ 정의서 IF (정확, 일부 협의중)
        │ §0 게이트 (C: 확정=lock / 협의중=보강가능)
        ▼
dt-spec / dt-bespec (deep-read로 협의중 IF 보강)
        │ 상향 정합 (B: detectDrift → 드리프트 리포트(필수) + 보강 제안)
        ▼
정의서 (사용자 확인 후 협의중 IF → 확정 반영)
```

- **위→아래**(기존): 정의서 버전↑ → leaf에 stale 경고(`isStale`/`computeImpacted`).
- **아래→위**(신규): leaf deep-read 발견 → 정의서 드리프트 리포트(`detectDrift`) + 보강 제안.

## 8. 영향 파일

| 파일 | 변경 |
|---|---|
| `dt-devspec/SKILL.md` | A: 불변원칙 1 완화 + 흐름 §1 deep-read |
| `dt-spec-generate-spec/SKILL.md` | C: §0 인용 규칙 / B: 상향 정합 게이트 |
| `dt-bespec-generate-spec/SKILL.md` | C·B 동일(BE 대칭) |
| `scripts/definitionPropagation.mjs` | B: `detectDrift` 추가(양방향) |
| `tests/definitionPropagation.test.mjs` | `detectDrift` 단위 테스트 |
| `dt-devspec/examples/sample-definition.md` | 합의 상태(확정/협의중) 예시 보강 |

## 9. 테스트 전략

- `detectDrift` 단위 테스트: (a) 누락(IF에 sort 없음 / 계약에 sort 있음) → `missing:['sort']`, (b) 일치 → 빈 결과, (c) 메서드/상태코드 모순 → `conflicting`. IF-18 정렬 케이스를 픽스처로.
- SKILL 변경은 마크다운 — 기존 스크립트 테스트 회귀 0 확인.
- 정합성: A(불변원칙 1) ↔ B(deep-read 1회) ↔ C(lock/보강) 간 모순 없음 어드버서리얼 검증.

## 10. 다음 단계

`writing-plans`로 구현 플랜 작성 → subagent-driven 구현:
① `detectDrift` TDD → ② dt-devspec A 패치 → ③ dt-spec/dt-bespec C 패치 → ④ dt-spec/dt-bespec B 패치 → ⑤ sample 보강 → ⑥ 전체 정합성 검증.
