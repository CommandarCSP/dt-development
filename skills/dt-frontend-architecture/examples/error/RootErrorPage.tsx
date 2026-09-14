import { Button } from '@/components/ui/button';

interface RootErrorPageProps {
  onReset: () => void;
}

// 전역 최종 폴백 — 런타임/예상외 에러로 앱이 더 진행할 수 없을 때.
export function RootErrorPage({ onReset }: RootErrorPageProps) {
  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-8 text-center"
    >
      <h1 className="text-lg font-semibold text-foreground">문제가 발생했습니다</h1>
      <p className="text-sm text-muted-foreground">
        잠시 후 다시 시도해 주세요. 문제가 계속되면 관리자에게 문의해 주세요.
      </p>
      <Button onClick={onReset}>처음으로</Button>
    </div>
  );
}
