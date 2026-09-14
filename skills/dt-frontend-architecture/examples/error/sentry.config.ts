import * as Sentry from '@sentry/react';
import { getHttpStatus, maskIds } from './httpMeta';

// SDK 셋업은 공식 sentry-react-sdk 전제. 여기선 팀 규약(PII/필터/샘플링)만 고정한다.
export function initSentry(): void {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: import.meta.env.PROD ? 0.05 : 1.0,
    // 고급: 고정 비율 대신 경로별 상향/하향이 필요하면 tracesSampleRate를 지우고 tracesSampler를 쓴다
    // (둘 중 하나만). 예)
    //   tracesSampler: (ctx) => {
    //     if (ctx.name.includes('/health')) return 0;      // 잡음 경로 버림
    //     if (ctx.name.startsWith('/checkout')) return 1.0; // 크리티컬 경로 전량
    //     return import.meta.env.PROD ? 0.05 : 1.0;
    //   },
    integrations: [Sentry.browserTracingIntegration()],

    // 기대된 오류는 보내지 않는다.
    beforeSend(event, hint) {
      const status = getHttpStatus(hint?.originalException);
      if (status === 401 || status === 404) return null;
      return event;
    },

    // 발자취의 URL에서 id·쿼리스트링을 가린다.
    beforeBreadcrumb(breadcrumb) {
      const url = breadcrumb.data?.url;
      if (typeof url === 'string') {
        breadcrumb.data = { ...breadcrumb.data, url: maskIds(url) };
      }
      return breadcrumb;
    },
  });
}
