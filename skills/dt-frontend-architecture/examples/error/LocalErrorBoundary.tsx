import type { ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { LocalErrorSection } from './LocalErrorSection';
import { classifyError } from './classifyError';
import { reportError } from './reportError';

// 자기 책임(도메인 복구 가능 = network/api)만 표시하고, 책임 밖(auth/runtime)은
// rethrow해 상위(Api→Root) 경계로 위임한다([[fallback-escalation]]).
function isDomainRecoverable(error: unknown): boolean {
  const kind = classifyError(error);
  return kind === 'network' || kind === 'api';
}

// 페이지 일부 블록만 감싸는 경계 — 나머지 영역(헤더/푸터 등)은 정상 유지된다.
export function LocalErrorBoundary({
  children,
  height,
}: {
  children: ReactNode;
  height?: number | string;
}) {
  const { reset } = useQueryErrorResetBoundary();
  return (
    <ErrorBoundary
      onReset={reset}
      onError={(error, info) => reportError(error, info)}
      FallbackComponent={({ error, resetErrorBoundary }: FallbackProps) => {
        if (!isDomainRecoverable(error)) throw error; // 책임 밖 → 상위 경계로 위임
        return <LocalErrorSection height={height} onRetry={resetErrorBoundary} />;
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
