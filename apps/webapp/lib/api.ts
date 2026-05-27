import { getInitData } from './telegram';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('gc_token', token);
    else localStorage.removeItem('gc_token');
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('gc_token');
  }
  return authToken;
}

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}
export interface ApiError {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = {};
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const initData = getInitData();
  if (initData) headers['X-Telegram-Init-Data'] = initData;

  // Content-Type faqat body bo'lganda
  const hasBody = body !== undefined && body !== null;
  if (hasBody) headers['Content-Type'] = 'application/json';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    const res = await fetch(url, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const json = await res.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return {
        ok: false,
        error: { code: 'NETWORK', message: `HTTP ${res.status}` },
      };
    }
    // Fastify xato formati: { statusCode, error: "string", message, code }
    if (!('ok' in json)) {
      return {
        ok: false,
        error: {
          code: json.code || json.error || 'SERVER_ERROR',
          message: json.message || `HTTP ${res.status}`,
        },
      };
    }
    return json as ApiResponse<T>;
  } catch (e) {
    return {
      ok: false,
      error: { code: 'NETWORK', message: e instanceof Error ? e.message : 'Network error' },
    };
  }
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// Auth: initData orqali kirish va token olish
export async function loginWithTelegram() {
  const initData = getInitData();
  if (!initData) {
    return {
      ok: false as const,
      error: { code: 'NO_INIT_DATA', message: 'Telegram WebApp ichida emas' },
    };
  }
  const res = await api.post<{ token: string; user: any }>('/api/auth/telegram', { initData });
  if (res.ok) {
    setAuthToken(res.data.token);
  }
  return res;
}
