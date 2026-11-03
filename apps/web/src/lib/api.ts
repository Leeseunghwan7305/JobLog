import { clearToken, getToken } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

export const kakaoLoginUrl = `${BASE}/auth/kakao/login`;

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers,
  });

  if (res.status === 401) {
    // 만료·무효 토큰 → 로그인 벽으로 가두지 않고, 토큰만 비우고
    // 체험 가능한 랜딩('/')으로 보낸다 (value-first: 로그인 먼저 강요 X).
    if (typeof window !== 'undefined') {
      clearToken();
      window.location.href = '/';
    }
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    // 서버(Nest)의 { message } 를 꺼내 사용자에게 보여줄 수 있게 한다.
    const body = (await res.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const msg = Array.isArray(body?.message)
      ? body?.message.join(', ')
      : body?.message;
    throw new Error(msg ?? `API ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
