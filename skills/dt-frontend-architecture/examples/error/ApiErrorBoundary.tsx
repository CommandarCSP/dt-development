import type { ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { RetryErrorFallback } from './RetryErrorFallback';
import { reportError } from './reportError';

function ApiFallback({ error, resetErrorBoundary }: FallbackProps) {
  return <RetryErrorFallback error={error} onRetry={resetErrorBoundary} />;
}

// Domain Component 묶음을 감싸는 경계.
// - onReset: react-query 에러 상태를 리셋해 "다시 시도"가 쿼리를 다시 굽게 한다.
// - resetKeys: 라우트(location.key) 변경 시 자동 리셋.
// throwOnError로 던져진 쿼리 에러는 여기서 잡힌다([[query-error-policy]]).
export function ApiErrorBoundary({ children }: { children: ReactNode }) {
  const { reset } = useQueryErrorResetBoundary();
  const location = useLocation();
  return (
    <ErrorBoundary
      FallbackComponent={ApiFallback}
      onReset={reset}
      resetKeys={[location.key]}
      onError={(error, info) => reportError(error, info)}
    >
      {children}
    </ErrorBoundary>
  );
}
