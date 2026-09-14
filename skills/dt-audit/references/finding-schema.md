# dt-audit Finding 스키마 (단일 소스)

auditor 워커와 dt-audit 조율자가 공유하는 판정 어휘. 여기 없는 gapType/confidence 값을 만들지 않는다.

## Finding

```
{ id: A-###,                       # 리포트 내 안정 키 (조율자가 병합 시 부여)
  track: fe|be|ux|spec|cross,      # spec=문서 전수 대조 트랙, cross는 조율자 전용(크로스스택 판정)
  gapType: <아래 6종 중 1>,
  specDiagnosis?: silent|ambiguous|conflict|absent,   # 스펙 진단 축(옵셔널) — 있으면 SB(스펙 보강 제안) 소스
  severity: CRITICAL|HIGH|MEDIUM|LOW,
  confidence: <아래 3종 중 1>,
  sourceRef: FR-3 | IF-7 | "GET /posts×401" | US1/AC2,   # undocumented는 코드 측 참조(파일:라인)
  evidence: 파일:라인 | evidence/<스크린샷>.png | git 커밋 sha,
  action: code-fix|spec-update|confirm,
  description: 무엇이 어떻게 다른지 1~3문장 + 권장 조치 }
```

## specDiagnosis 4종 (스펙 진단 축 — gapType과 직교)

"이 발견이 스펙에 대해 무엇을 말해주는가". 값이 있으면 그 finding은 리포트 §2.5
스펙 보강 제안(SB)의 소스가 되고, 기본 action은 `spec-update`(또는 confirm)로 기운다.

| 값 | 뜻 |
|---|---|
| `silent` | 스펙이 안 정해서 구현이 임의 결정 (계약 요소 체크리스트 `contract-elements.md`로 수집) |
| `ambiguous` | 스펙이 두 가지로 읽혀 구현이 한쪽을 고름 |
| `conflict` | 문서끼리 다른 말 (정의서 ↔ leaf 스펙 등) |
| `absent` | 검사 단위 자체가 스펙에 없음 (페이지/리소스 통째) |

값이 없으면 순수 코드 갭(스펙은 명확한데 구현이 어긋남)이다.

## gapType 6종 (spec-kit converge 4분류 + 자체 2분류)

| 값 | 의미 | 기본 action |
|---|---|---|
| `missing` | 스펙에 있는데 구현에 전혀 없음 | code-fix |
| `partial` | 구현은 있는데 요구를 불완전 충족 | code-fix |
| `mismatch` | 구현이 스펙과 상충 (spec-kit `contradicts`) | code-fix 또는 spec-update |
| `drift` | 스펙이 코드보다 나중에 갱신됐는데 미반영 — **git 근거 필수** (`drift-detection.md`) | code-fix |
| `undocumented` | 구현에 있는데 스펙에 없음 (spec-kit `unrequested` — 역방향) | spec-update 또는 confirm |
| `improvement` | 정합하지만 개선 여지 — **LOW 고정, 스펙이 침묵하는 영역에서 사용자 가치가 분명한 것만**(남발 금지) | confirm |

## severity (spec-kit converge §5 차용)

- **CRITICAL**: 핵심 사용자 스토리의 기본 동작을 막는 missing/mismatch/drift
- **HIGH**: 핵심 FR/IF/AC의 missing/partial/drift
- **MEDIUM**: 부차 요구의 partial, 사유 불명 undocumented
- **LOW**: 사소한 partial · improvement

## confidence (Reversa 차용)

- `🟢 confirmed` — 코드/화면에서 직접 확인
- `🟡 inferred` — 패턴 추론
- `🔴 needs-human` — 사람 판단 필요. **findings 본문이 아닌 리포트 "확인 필요" 섹션에 격리**(오탐을 단정 보고하지 않음)

## 워커 → 조율자 반환 계약

원자료(코드 본문·snapshot 전문·git diff 전문)는 워커 컨텍스트에 격리하고 이 구조만 반환한다:

```
{ track,
  findings: [Finding...],          # id는 비워서 반환(조율자가 부여)
  surface: {...},                  # 크로스스택용 — fe: 호출 API 목록(IF-ID 매핑 포함), be: 노출 엔드포인트 목록
  traceability: [ {sourceRef, files: [...]} ],
  checked: { units: N, skipped: [{unit, 사유}] },
  staleSpecs: [ {spec, basedOn, currentVersion} ] }   # basedOnDefinition isStale 결과
```
