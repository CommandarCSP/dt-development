// axios를 직접 import하지 않는다(service-location). isAxiosError 마커로 구조 판별.
type AxiosLike = {
  isAxiosError?: boolean;
  config?: { method?: string; url?: string };
  response?: { status?: number };
};

function asAxios(error: unknown): AxiosLike | null {
  if (error && typeof error === 'object' && (error as AxiosLike).isAxiosError === true) {
    return error as AxiosLike;
  }
  return null;
}

export function getHttpStatus(error: unknown): number | undefined {
  return asAxios(error)?.response?.status;
}

export function getMethod(error: unknown): string | undefined {
  const m = asAxios(error)?.config?.method;
  return m ? m.toUpperCase() : undefined;
}

// URL의 숫자·UUID 세그먼트와 쿼리스트링을 가려 경로 템플릿으로 만든다.
// /users/1234?tab=x → /users/:id  (그룹핑·PII 안전)
export function maskIds(url: string): string {
  const path = url.split('?')[0];
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id');
}

export function getRouteTemplate(error: unknown): string | undefined {
  const url = asAxios(error)?.config?.url;
  return url ? maskIds(url) : undefined;
}
