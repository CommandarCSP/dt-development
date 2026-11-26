---
ruleId: sentry-breadcrumb-no-pii
summary: "커스텀 브레드크럼 data에는 식별용 값(id)만 — 이름·이메일·본문 등 개인정보(PII) 금지"
severity: minor
appliesTo: ["src/**/*.{ts,tsx}"]
detection:
  - type: forbidden-pattern
    pattern: "addBreadcrumb\(\s*\{[^)]*?\bdata\s*:\s*\{[^}]*\b(?:email|phone|phoneNumber|mobile|name|userName|fullName|password|token|body|content|address)\b"
    rationale: "브레드크럼 data 에 개인정보로 보이는 키(email·phone·name·body …)가 있다 — 식별용 id 만 담는다"
  - type: manual
    description: "키 이름이 달라 기계가 못 보는 개인정보(예: `contact`, 변수에 담아 넘김)는 사람이 본다"
relatedRules: [sentry-single-capture]
---

# 브레드크럼에 개인정보를 담지 않는다

`Sentry.addBreadcrumb`의 `data`에는 화면 이동·의도를 재현할 **식별용 값(id)만** 담는다.
이름·이메일·전화번호·본문 내용 같은 개인정보(PII)는 담지 않는다.
발자취는 이벤트와 함께 전송되므로, 여기 담긴 값은 그대로 Sentry로 나간다.

## ✅ Correct

```ts
Sentry.addBreadcrumb({ category: 'user-action', message: '댓글 작성 시도', level: 'info', data: { postId } });
```

## ❌ Incorrect

```ts
Sentry.addBreadcrumb({ category: 'user-action', message: '댓글 작성', data: { email, body } });
```

## 탐지

- 기계 검사: `addBreadcrumb({ … data: { … } })`의 `data`에 `email`·`phone`·`name`·`password`·`token`·`body`·`content`·`address` 같은 키가 있으면 위반이다.
- 사람 확인: 이름이 다른 키나 변수로 넘긴 값은 리뷰어가 본다.
전송 단계의 최종 방어는 `Sentry.init`의 `beforeBreadcrumb`/`beforeSend` 마스킹이다.
관련 설계: [Sentry 관측 계층](../references/sentry-observability.md).
