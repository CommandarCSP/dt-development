---
ruleId: modal-management
summary: "모달은 nice-modal-react로 중앙 관리 — id 상수(src/modals/ids.ts) + 등록(src/modals/registry)만, 컴포넌트는 id로 show/resolve. 컴포넌트별 isOpen useState 분산 금지"
severity: important
appliesTo: ["src/**/*.{ts,tsx}"]
excludePathPatterns: ["src/modals/**"]
detection:
  - type: forbidden-pattern
    pattern: "NiceModal\\.register"
    rationale: "모달 등록(NiceModal.register)은 src/modals/registry 단일 위치에서만 — 분산 등록 금지"
relatedRules: [server-vs-client-state, pure-view-component, centralized-query-keys]
---

# 모달(팝업)은 nice-modal-react로 ID 기반 중앙 관리

확인/다이얼로그 등 전역 팝업은 `@ebay/nice-modal-react`로 관리한다. 모달 가시성은
**클라이언트 UI 상태**이므로(서버 데이터 아님), 컴포넌트마다 `isOpen` useState를
흩뿌리지 않고 id 기반으로 중앙에서 띄운다(queryKey 중앙관리와 같은 철학).

## 레이어 배치

| 요소 | 위치 |
|---|---|
| `NiceModal.Provider` | `App.tsx` 루트 (RouterProvider 감싸기) |
| 모달 id 상수 | `src/modals/ids.ts` (`MODAL_IDS`) |
| id↔컴포넌트 등록 | `src/modals/registry.ts` (앱에서 1회 import) |
| 모달 컴포넌트 | `src/components/domain/modals/*` — `useModal()` 훅을 쓰므로 순수 View 아님 → Domain. 내부는 View 조합 |
| 여는 행위 | Business Hook(ViewModel), 예: `useConfirm()` → `NiceModal.show(id)` |

## 왜 중요한가
- 컴포넌트별 `isOpen` 상태 분산 → prop drilling, 중복 토글 로직, 닫기 누락 버그
- `NiceModal.show()`는 Promise를 반환(`modal.resolve(value)`)해 `const ok = await confirm(...)`처럼
  결과 기반 흐름을 prop drilling 없이 작성 가능
- 토스트는 모달 메커니즘으로 관리하지 않는다(자동 소멸·큐잉·비블로킹) — UI Store/전용 라이브러리 사용

## ❌ Incorrect

```tsx
// 컴포넌트마다 모달 상태 분산 + register를 아무 데서나
function CommentItem() {
  const [confirmOpen, setConfirmOpen] = useState(false); // 분산된 모달 상태
  return (
    <>
      <button onClick={() => setConfirmOpen(true)}>삭제</button>
      {confirmOpen && <ConfirmDialog onClose={() => setConfirmOpen(false)} />}
    </>
  );
}
```

## ✅ Correct

```ts
// src/modals/ids.ts
export const MODAL_IDS = { confirm: 'confirm' } as const;

// src/modals/registry.ts (앱에서 1회 import)
NiceModal.register(MODAL_IDS.confirm, ConfirmModal);

// src/business/hooks/modal/useConfirm.ts
export function useConfirm() {
  return (props: ConfirmModalProps): Promise<boolean> =>
    NiceModal.show(MODAL_IDS.confirm, props) as Promise<boolean>;
}
```

```tsx
// Domain Component — 의도만 다루고 모달 구현은 모른다
const confirm = useConfirm();
const handleDelete = async (id: number) => {
  if (await confirm({ message: '삭제할까요?', destructive: true })) {
    deleteComment(id);
  }
};
```

## 스택 노트
- 모달 **관리**(nice-modal-react: 중앙 레지스트리·id show/resolve)와 모달 **UI**(shadcn Dialog = Radix)는 직교 — 함께 사용한다. Dialog 컴포넌트는 UI 렌더링, nice-modal-react는 어느 모달을 언제 띄울지 관리.

## 관련 규칙
- [[server-vs-client-state]] — 모달 가시성은 client 상태
- [[pure-view-component]] — useModal()을 쓰는 모달 컴포넌트는 Domain 레이어
- [[centralized-query-keys]] — id/key 중앙 관리 철학 공유
