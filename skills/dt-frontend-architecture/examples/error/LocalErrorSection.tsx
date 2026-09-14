import { Button } from '@/components/ui/button';

interface LocalErrorSectionProps {
  height?: number | string;
  onRetry: () => void;
}

// 페이지 일부 블록만 폴백 — 나머지 영역(헤더/푸터 등)은 정상 유지된다.
export function LocalErrorSection({ height = 160, onRetry }: LocalErrorSectionProps) {
  return (
    <div
      role="alert"
      style={{ minHeight: typeof height === 'number' ? `${height}px` : height }}
      className="flex flex-col items-center justify-center gap-2 rounded-md bg-muted/30 p-4 text-center"
    >
      <p className="text-sm text-muted-foreground">이 영역을 불러오지 못했습니다.</p>
      <Button variant="ghost" size="sm" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}
