import { getToken } from './auth';

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
    if (typeof window !== 'undefined') window.location.href = '/login';
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
