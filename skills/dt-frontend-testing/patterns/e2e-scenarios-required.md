---
ruleId: e2e-scenarios-required
summary: "스펙(requirements.md)은 있는데 수용 e2e 원장(*.e2e-scenarios.md)이 없는 페이지를 존재 안전망으로 경고(머지 차단 아님)"
severity: minor
appliesTo: ["src/pages/**/*.tsx"]
detection:
  - type: requires-acceptance-ledger
    description: "docs/specs/pages/*/ 중 requirements.md는 있으나 *.e2e-scenarios.md 원장이 없는 디렉토리를 찾아 경고. /dt-e2e 실행을 권장."
relatedRules: [page-integration-required, e2e-playwright]
---

# 수용 e2e 원장 존재 안전망 (advisory)

## 왜 이 룰?

스캐폴드(Phase 5 개편)는 더 이상 개발단 e2e를 자동 생성하지 않는다 — 수용 e2e는 `/dt-e2e`에서
사람이 주도해 저작한다(dt-e2e 설계 §1). 그 결과 "스펙은 만들었는데 수용 원장을 아무도 안 만든"
페이지가 조용히 방치될 수 있다. 이 룰은 그 공백을 리뷰가 **알려주는** 존재 안전망이다.

## 검사 기준이 페이지 파일이 아니라 스펙 디렉토리인 이유

페이지 파일명 ↔ 원장명은 **기계 매핑이 불가**하다. 실례로 페이지 `FeedPostDetailPage.tsx`의
원장은 `docs/specs/pages/feed-detail/feed-detail.e2e-scenarios.md`다 — 파일명 규칙만으로는
둘을 이어붙일 수 없다. 반면 스펙 디렉토리(`docs/specs/pages/<dir>/`)는 확정된 단위라,
`requirements.md`(스펙 존재)와 `*.e2e-scenarios.md`(원장 존재)의 유무를 결정적으로 검사할 수 있다.
`appliesTo`는 페이지 변경을 트리거로 삼되(리뷰 대상 diff에 페이지가 포함될 때 발동), 실제 판정은
스펙 디렉토리를 스캔한다.

## minor인 이유

수용 시나리오를 **만들지 말지는 사람의 결정**이다. 이 룰을 important/critical로 올리면 형식적
e2e 원장을 양산하게 되고(값 없는 그린), 그건 dt-e2e의 "많이가 아니라 옳게" 원칙에 반한다.
그래서 머지 차단이 아니라 minor 경고로 둔다 — "여기 원장이 비었어요, `/dt-e2e` 돌릴까요?"

## 중복 처리

이 룰은 여러 페이지 파일마다 호출되지만 finding은 스펙 디렉토리에 종속(변경 파일과 무관)이라
호출마다 같은 finding이 중복될 수 있다. detection 모듈이 (1) 단일 호출 내부는 디렉토리 정렬·
중복제거로, (2) 호출 간(run 전체)은 엔진이 run당 1개 주입하는 `ctx.cache` 공유 객체로 dedupe한다.
모듈 스코프 전역 캐시는 테스트 격리를 깨므로 쓰지 않는다.

## 관련 규칙
- [[page-integration-required]] (개발단 방어선 — 이건 강제, 수용 원장은 권장)
- [[e2e-playwright]] (원장이 저작될 때 지켜야 할 Playwright 규약)
