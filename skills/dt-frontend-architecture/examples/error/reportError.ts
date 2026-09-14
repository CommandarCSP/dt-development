import * as Sentry from '@sentry/react';
import { classifyError, type ErrorKind } from './classifyError';
import { getHttpStatus, getMethod, getRouteTemplate } from './httpMeta';

const LEVEL: Record<ErrorKind, Sentry.SeverityLevel> = {
  network: 'warning',
  notFound: 'info',
  api: 'error',
  auth: 'info',
  runtime: 'error',
};

// 모든 경계·캐시 오류가 합류하는 단일 진입점. 여기서만 Sentry로 캡처한다.
export function reportError(error: unknown, info?: { componentStack?: string | null }): void {
  const kind = classifyError(error);
  const status = getHttpStatus(error);

  // 404는 장애가 아니라 기대 오류(없음) — sentry.config beforeSend에서도 필터되므로 여기서 캡처 제외.
  if (kind === 'notFound') return;

  Sentry.captureException(error, {
    level: kind === 'api' && status && status < 500 ? 'warning' : LEVEL[kind],
    tags: { type: kind, ...(status ? { status: String(status) } : {}) },
    contexts: info?.componentStack ? { react: { componentStack: info.componentStack } } : undefined,
    fingerprint:
      kind === 'api' && status
        ? [getMethod(error) ?? 'UNKNOWN', String(status), getRouteTemplate(error) ?? 'unknown']
        : undefined,
  });
}
