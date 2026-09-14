export type ErrorKind = 'network' | 'notFound' | 'api' | 'auth' | 'runtime';

// axios를 직접 import하지 않는다(service-location: axios는 src/services/** 한정).
// axios 에러는 `isAxiosError: true` 마커를 갖는다 — 구조로 판별한다.
type AxiosLikeError = { isAxiosError?: boolean; response?: { status?: number } };

function asAxiosError(error: unknown): AxiosLikeError | null {
  if (error && typeof error === 'object' && (error as AxiosLikeError).isAxiosError === true) {
    return error as AxiosLikeError;
  }
  return null;
}

export function classifyError(error: unknown): ErrorKind {
  const axiosError = asAxiosError(error);
  if (axiosError) {
    if (!axiosError.response) return 'network';
    const status = axiosError.response.status;
    if (status === 401 || status === 403) return 'auth';
    // 404는 장애가 아니라 없음 — 페이지가 없음 UI로 처리(문구는 페이지 소유).
    if (status === 404) return 'notFound';
    return 'api';
  }
  return 'runtime';
}

