---
ruleId: interactive-a11y
summary: "onClick을 가진 비버튼/비링크 요소는 role=button·tabIndex=0·Enter/Space 키 핸들러 3종을 갖춘다"
severity: important
appliesTo: ["src/components/view/**/*.{ts,tsx}", "src/components/domain/**/*.{ts,tsx}"]
detection:
  - type: ast-rule
    description: "onClick이 붙은 비인터랙티브 요소(div·article·section·li·span 등, button/a/input 아님)는 다음 3종을 모두 가져야 한다: (1) role=\"button\", (2) tabIndex={0}, (3) onKeyDown에서 Enter·Space 처리(e.key === 'Enter' || e.key === ' ') 후 preventDefault. 한 개라도 없으면 위반. 예외: 컨테이너 자신은 onClick으로 내비게이션/액션을 수행하지 않고, 내부의 실제 <button>/<a>가 모든 동작을 담당하는 순수 래퍼일 때만 면제된다(컨테이너가 직접 navigate/액션을 호출하면 면제 아님 — 3종 필요). 수동 검토."
relatedRules: [pure-view-component, view-styling]
---

<!-- from: audit 2026-07-24-all A-003 -->

# 클릭 가능한 비버튼 요소는 키보드로도 조작 가능해야 한다

## 왜 중요한가
`onClick`만 붙은 `<div>`·`<article>` 같은 요소는 마우스로만 조작할 수 있다.
- 키보드 사용자(Tab 이동·Enter/Space 실행)가 해당 동작에 접근할 수 없다
- 스크린리더가 "클릭 가능한 요소"임을 알리지 못한다(role 없음)
- 시맨틱상 버튼임에도 포커스 순서에서 빠진다(tabIndex 없음)

`<button>`/`<a>`는 이 3종을 브라우저가 기본 제공한다. 비인터랙티브 요소에 클릭을
얹었다면 이를 **직접** 복원해야 한다: `role="button"`, `tabIndex={0}`, `Enter/Space` 키 핸들러.

## ❌ Incorrect

```tsx
// 상세로 이동하는 카드 컨테이너가 onClick만 — 키보드로 진입 불가
export function FeedPostCard({ postId, onClick }: Props) {
  return (
    <article className="cursor-pointer ..." onClick={() => onClick(postId)}>
      {/* ... */}
    </article>
  );
}
```
(현재 실측 프로젝트의 `FeedPostCard`의 카드 컨테이너 `<article>` 케이스 — 작성자 영역은 3종을
갖췄으나 상세로 이동하는 컨테이너는 `onClick`만 있어 키보드로 게시물 상세 진입 불가.)

## ✅ Correct

```tsx
import type { KeyboardEvent } from 'react';

export function FeedPostCard({ postId, onClick }: Props) {
  function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(postId);
    }
  }

  return (
    <article
      className="cursor-pointer ..."
      role="button"
      tabIndex={0}
      onClick={() => onClick(postId)}
      onKeyDown={handleKeyDown}
    >
      {/* ... */}
    </article>
  );
}
```

## 예외 — 순수 래퍼
컨테이너에 `onClick`이 있어도 그 동작이 **내부의 실제 `<button>`/`<a>`로 완전히
위임**되고 컨테이너 자신은 내비게이션·액션을 수행하지 않는다면 3종은 불필요하다.
반대로 컨테이너가 직접 `navigate(...)`·핸들러를 호출하면(위 예처럼) 위임이 아니므로
3종을 반드시 갖춘다.

## 관련 규칙
- [[pure-view-component]]
- [[view-styling]]
