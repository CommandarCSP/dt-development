import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { reportError } from './reportError';

// 화면 경계까지 닿지 않는 데이터 조회·변경 오류를 같은 진입점으로 모은다.
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: (error) => reportError(error) }),
  mutationCache: new MutationCache({ onError: (error) => reportError(error) }),
  // 자동 재시도는 에러 표면화를 늦추고(스피너 수 초) 경계의 재시도 버튼 UX와 중복.
  // 알려진 불안정 엔드포인트만 per-query로 retry를 명시한다.
  defaultOptions: { queries: { retry: false } },
});
