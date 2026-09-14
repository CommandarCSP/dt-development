import * as Sentry from '@sentry/react';

// 도메인/비즈니스 계층에서 "무엇을 하려 했는가"를 한 줄로 남긴다.
// data에는 식별용 값(id)만 — 이름/이메일/본문 금지([[sentry-breadcrumb-no-pii]]).
export function leaveActionBreadcrumb(message: string, data?: Record<string, string | number>): void {
  Sentry.addBreadcrumb({ category: 'user-action', message, level: 'info', data });
}
