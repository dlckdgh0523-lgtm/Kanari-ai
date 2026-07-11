// 카나리 API 클라이언트. 토큰은 localStorage에 보관하고 모든 요청에 싣는다.
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function getToken() {
  return localStorage.getItem('kanari_token');
}

export function setSession(token: string, email: string) {
  localStorage.setItem('kanari_token', token);
  localStorage.setItem('kanari_email', email);
}

export function clearSession() {
  localStorage.removeItem('kanari_token');
  localStorage.removeItem('kanari_email');
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(BASE + path, {
    method: options.method ?? 'GET',
    headers: {
      'content-type': 'application/json',
      ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (res.status === 401) {
    clearSession();
    window.location.href = '/login';
    throw new Error('unauthorized');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new Error(msg ?? `요청 실패 (${res.status})`);
  }
  return data as T;
}

// ---- 타입 (서버 엔티티와 맞춘다) ----
export interface Project {
  id: number;
  name: string;
  discordWebhookUrl: string | null;
  repoUrl: string | null;
  createdAt: string;
}

export interface ErrorGroup {
  id: number;
  projectId: number;
  name: string;
  message: string;
  topFrame: string;
  status: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolveNote: string | null;
  resolvedAt: string | null;
  firstRelease: string | null;
  regressed: boolean;
}

export interface ErrorEvent {
  id: number;
  groupId: number;
  level: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  traceId: string | null;
  occurredAt: string;
}

export interface SyntheticCheck {
  id: number;
  name: string;
  url: string;
  method: string;
  expectedStatus: number;
  intervalSec: number;
  enabled: boolean;
  lastStatus: string;
  failStreak: number;
  lastCheckedAt: string | null;
}
