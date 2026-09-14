# Walkthrough: file-management (single-domain)

입력: `/dt-implement docs/specs/pages/file-management`

1. parseSpecForScaffold → { status: draft, page: file-management, domains: [{files, new-domain}], multiDomain: false, proposedApiCount: 5 }
2. draft 확인 → 진행 (제안 계약에 TODO 주석)
3. 단일 도메인 → 바로 위임
4. files 도메인 Phase 1~4 (types/queryKey/contract → services fetcher + DTO + query/mutation → view(테이블/모달) → business hook). {SPEC_EXCERPT}에 design 계약/layout-skeleton/시퀀스 발췌 주입.
5. Phase 5: FileManagement 페이지 + 라우트.
6. 게이트(tsc/vitest/리뷰) 통과 → worktree 안내.

기대 산출(요약): src/services/files, src/store/queries/files, src/business/hooks/files, src/components/(view|domain), src/pages/FileManagement*.

> 실제 실행 후 결과/이슈를 이 문서에 갱신한다.
