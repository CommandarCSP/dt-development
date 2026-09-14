# E2E scenario: comments domain (manual)

Date: 2026-05-22  
Plan: Plan 3, Task 14  
Scenario: Walk Phase 0 + Phase 1 + Phase 2 (partial) of new-domain.md using a temp directory + template copy.

## Setup

> **Deprecated setup**: 보일러플레이트 `template/`은 제거됨. 이제 공식 CLI로 스캐폴드한다(new-project.md 참조):
```bash
npm create vite@latest /tmp/dt-frontend-e2e-scenario -- --template react-ts
cd /tmp/dt-frontend-e2e-scenario
# dt-frontend 컨벤션(Tailwind/shadcn/@alias/.dt-frontend.json) 적용 후
git init && git add . && git commit -m "init"
pnpm install
```

Result: **OK** — git init succeeded (40 files committed), pnpm install succeeded in ~9s.

---

## Phase 0: Worktree creation

```bash
node <프로젝트 경로>/skills/dt-frontend-scaffold/scripts/worktree.mjs create test-comments
```

Output:
```
/private/tmp/dt-frontend-e2e-scenario/.dt-frontend/worktrees/test-comments
```

Result: **OK** — worktree directory created at `.dt-frontend/worktrees/test-comments`. Prints the absolute path on success.

---

## Phase 1: Contracts + tsc gate

### Files created in worktree

**`src/types/comment.ts`** — Model(ViewModel)만
```ts
export interface Comment { id: number; postId: number; author: string; body: string; }
```

**`src/services/comment/types.ts`** — DTO (Phase 2 store-query가 생성)
```ts
export interface CommentDto { id: number; postId: number; name: string; email: string; body: string; }
```

**`src/store/queries/comments/keys.ts`**
```ts
export const commentKeys = {
  all: ['comments'] as const,
  list: (params: { postId: number }) => [...commentKeys.all, 'list', params] as const,
};
```

**`src/contracts/comments.contract.ts`** — full contract with `UseCommentListQuery`, `UseCommentListViewModel`, `CommentItemProps`, `CommentListProps` interfaces (same shape as `examples/contract.ts`).

### Gate run

```bash
node .../gate.mjs --project $(pwd) --vitest false --review false
```

Exit: **0** (no output = all enabled gates passed).

tsc verified directly:
```bash
npx tsc --noEmit
# exit 0 — no errors
```

Result: **OK** — tsc passes cleanly on the contract files.

---

## Phase 2 (partial): Store query + review gate

### File created

**`src/store/queries/comments/useCommentListQuery.ts`**  
Implements `UseCommentListQuery` contract: uses `useQuery`, imports `commentKeys`, calls `apiClient.get('/posts/:id/comments')`, returns `data/isLoading/isError`.

### tsc after adding file

Exit: **0** — contract typing enforced correctly. No type mismatches.

### Gate run (review only)

```bash
node .../gate.mjs --project $(pwd) --tsc false --vitest false \
  --review-script .../review.mjs \
  --paths "src/store/queries/comments/useCommentListQuery.ts"
```

Exit: **0** — review passed.

### Review output (direct run)

```
### Manual Review (heuristic stubs, see Plan 3 for AST analysis)

- src/store/queries/comments/useCommentListQuery.ts — where-does-business-logic-go — (heuristic description)
- src/store/queries/comments/useCommentListQuery.ts — avoid-effect-for-derived-state — (heuristic description)

### Assessment

Ready to merge: Yes

Reasoning: 위반 없음.
```

Result: **OK** — review finds no critical violations. "Ready to merge: Yes".

---

## Cleanup

```bash
node .../worktree.mjs remove /tmp/dt-frontend-e2e-scenario/.dt-frontend/worktrees/test-comments
rm -rf /tmp/dt-frontend-e2e-scenario
```

Result: **OK** — worktree removed cleanly via `git worktree remove --force`, temp dir deleted.

---

## Summary of results

| Step | Result | Notes |
|---|---|---|
| Template copy + git init | OK | 40 files, clean commit |
| pnpm install | OK | ~9s, minor build-script warnings (esbuild, msw) |
| Phase 0: worktree create | OK | Printed path, directory created |
| Phase 1: contracts written | OK | 3 files: types, keys, contract |
| Phase 1: tsc gate | OK | Exit 0, no type errors |
| Phase 2: useCommentListQuery.ts | OK | Contract interface satisfied, tsc exit 0 |
| Phase 2: review gate | OK | "Ready to merge: Yes", 위반 없음 |
| Cleanup: worktree remove | OK | git worktree remove --force succeeded |
| Cleanup: rm -rf /tmp | OK | Directory removed |

## Known limitations observed

- Full Phase 2 parallel dispatch is not exercised here (requires Task tool from Claude session)
- Coverage gate not exercised (no real Vitest runs in scenario)
- Phase 3-5 not exercised (requires full domain implementation: view components, business hook, domain component)
- The review output is heuristic stubs (plan notes AST analysis planned for Plan 3) — rule checks are present but pattern-based rather than full AST
- > Note: In some pnpm versions, `esbuild` and `msw` postinstall scripts may require `pnpm approve-builds` once per machine. This is a pnpm UX wrinkle, not part of dt-frontend scaffold. If the install completes (even with warnings), proceed.

## Verification of next plan readiness

- worktree.mjs CLI: **works** — create and remove tested
- gate.mjs CLI: **works** — all flag combinations (--vitest false --review false, --tsc false --vitest false) parsed correctly
- review.mjs partial mode: **integrates correctly** — exit 0 on passing code, output readable, "Ready to merge" detection works
- tsc contract enforcement: **works** — Phase 1 contracts are valid TypeScript, Phase 2 implementation satisfies them
