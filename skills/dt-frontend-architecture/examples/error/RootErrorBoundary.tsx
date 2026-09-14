import type { ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { RootErrorPage } from './RootErrorPage';
import { reportError } from './reportError';

function RootFallback({ resetErrorBoundary }: FallbackProps) {
  return <RootErrorPage onReset={resetErrorBoundary} />;
}

// 앱 최상단 경계 — Api/Local 경계가 위임(rethrow)한 에러와 예상외 런타임 에러의 최종 캐치.
export function RootErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={RootFallback}
      onError={(error, info) => reportError(error, info)}
    >
      {children}
    </ErrorBoundary>
  );
}
