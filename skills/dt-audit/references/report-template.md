# dt-audit 리포트 템플릿

산출 위치: `docs/audits/YYYY-MM-DD-<scope>/` (`<scope>`=all|fe|be|ux|페이지·리소스 슬러그).
같은 날짜·스코프 재실행은 기존 폴더에 덮어쓰지 않고 `-2`, `-3` 서픽스.

## report.md

```markdown
# 감사 리포트 — <scope>

> 감사 일시: YYYY-MM-DD HH:mm · 기준 스펙: definition.md@v<N> + pages <n>개 + resources <m>개
> 검사 단위: <N>건 · 트랙: fe ✅ / be ✅ / ux ⏭️(앱 미기동) 등 미수행 사유 명시

## 1. 요약 매트릭스

| 페이지/리소스 | missing | partial | mismatch | drift | undocumented | improvement |
|---|---|---|---|---|---|---|
| feed | 1 | - | - | 1 | - | - |
(행 = 감사 단위, 값 = 건수. 전부 0이면 이 표 대신 "✅ Converged" 한 줄)

severity 분포: CRITICAL n · HIGH n · MEDIUM n · LOW n

## 2. Findings (severity 내림차순 — 🔴 제외)

| ID | Track | Gap | Sev | Conf | Source | Evidence | 권장 액션 |
|---|---|---|---|---|---|---|---|
| A-001 | fe | missing | HIGH | 🟢 | FR-3 | src/pages/feed.tsx | code-fix |

**A-001** — {description: 무엇이 어떻게 다른지 + 권장 조치}

...각 finding마다 반복...

**액션 소계**: code-fix n건 · spec-update n건 · confirm n건

## 2.5 스펙 보강 제안 (SB) — specDiagnosis가 붙은 finding의 변환

### SB-1 — <제목> (<specDiagnosis 조합>) ← <연결 finding id들>
- **구현이 내린 결정**: <동작> (<파일:라인>)
- **스펙 현황**: <문서별 현황·어긋남>
- **일반 관례**: <표준적 처리>
- **보강 문구 초안** (<대상 문서·위치>):
  > <붙여넣을 수 있는 초안 — 대상 문서의 기존 형식(EARS·IF 행·api-contract 표)을 따른다>
- **반영 대상**: <문서들> → 승인 시 <후속 스킬> 경로

(absent 항목은 as-built 역추출 결과가 백필 초안 소스가 된다.)

## 3. 확인 필요 (🔴 needs-human)

- [ ] {질문 형태로 — 예: "정렬 드롭다운이 구현에만 있습니다. 스펙 누락인가요, 제거 대상인가요?" (파일:라인)}

## 4. 드리프트 체인 (있을 때만)

- definition.md@v3 → pages/feed(basedOn @v2, stale) → src/pages/feed.tsx — {설명}

## 5. Traceability

전체 매핑: [traceability.md](./traceability.md)
```

### Converged 출력 (finding 0건)

섹션 1 자리에 `✅ Converged — 구현이 스펙을 충족합니다.` + 검사한 단위 수만 기록.
섹션 2~4 생략. 리포트 파일 자체는 생성한다(감사 수행 기록).

## traceability.md

다음 증분 감사의 시드. 워커 반환의 traceability를 병합해 기록한다.

```markdown
# Traceability — <scope> (YYYY-MM-DD)

| sourceRef | 구현 파일 |
|---|---|
| FR-1 (feed) | src/pages/feed.tsx, src/hooks/useFeed.ts |
| IF-3 | src/services/posts.ts ↔ api/src/posts/posts.controller.ts |
```

## 증분 감사 표기

이전 run의 findings와 sourceRef+evidence로 매칭해 각 finding에 상태를 병기:
`신규` | `잔존(A-003→A-001)` | 해결된 것은 섹션 2 끝에 "해결됨 n건: A-002, ..." 한 줄.

## decisions.md (협의 결과 — run 폴더 내)

형식·상태 어휘는 `consult-loop.md` SOT를 따른다. 협의를 안 했으면 파일을 만들지 않는다.

## pending.md (미결 원장 — docs/audits/ 직속, run 횡단, 프로젝트당 1개)

```markdown
# 감사 미결 원장
| 출처 run | 항목 | 요지 | 상태 |
|---|---|---|---|
| 2026-07-24-all | 🔴-1 | 댓글 정렬 소유권 | pending |
```
다음 /dt-audit §0이 이 파일을 읽어 협의 큐 최상단에 올린다. 해소되면 행 상태를 `resolved(<run>)`로.

## index.md (추이 원장 — docs/audits/ 직속, run당 1줄 append)

```markdown
# 감사 추이
| run | 검사 | 신규 | 잔존 | 해결 | CRIT/HIGH |
|---|---|---|---|---|---|
| 2026-07-24-all | 85 | 6 | - | - | 0 |
```
