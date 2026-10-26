const KEY = 'joblog_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(KEY);
}

// 로그인 유도 중 입력한 공고 URL을 리다이렉트 너머로 보존
const PENDING_URL = 'joblog_pending_url';

export function setPendingUrl(url: string): void {
  window.localStorage.setItem(PENDING_URL, url);
}

export function getPendingUrl(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(PENDING_URL);
}

export function clearPendingUrl(): void {
  window.localStorage.removeItem(PENDING_URL);
}
