import { Button } from '@/components/ui/button';
import { classifyError } from './classifyError';

interface RetryErrorFallbackProps {
  error: unknown;
  onRetry: () => void;
}

const MESSAGE: Record<ReturnType<typeof classifyError>, string> = {
  network: '네트워크 연결을 확인해 주세요.',
  api: '데이터를 불러오지 못했습니다.',
  auth: '접근 권한이 없습니다.',
  runtime: '문제가 발생했습니다.',
};

// Api(Domain) 경계 기본 폴백 — 재시도 시 react-query 에러 상태가 리셋된다(ApiErrorBoundary onReset).
export function RetryErrorFallback({ error, onRetry }: RetryErrorFallbackProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-md border border-border bg-muted/30 p-8 text-center"
    >
      <p className="text-sm text-muted-foreground">{MESSAGE[classifyError(error)]}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}
