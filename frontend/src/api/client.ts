// Thin fetch wrapper for the StockSense API.
// The access token lives in memory only; the refresh token is an httpOnly cookie the browser sends
// to /api/auth/*. On a 401 we refresh once (deduped) and retry.
import type { User } from '../types';

const BASE = '/api'; // proxied to the backend by vite.config.ts

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export interface Session {
  user: User;
  accessToken: string;
}

let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;

export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
/** Called when a refresh fails mid-session so the UI can send the user to /login. */
export const setSessionLostHandler = (fn: (() => void) | null) => {
  onSessionLost = fn;
};

async function send(method: string, path: string, body?: unknown, auth = true): Promise<Response> {
  return fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(auth && accessToken && { Authorization: `Bearer ${accessToken}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function toError(res: Response): Promise<ApiError> {
  let msg = res.statusText || 'Request failed';
  let details: unknown;
  try {
    const j = await res.json();
    msg = j?.error?.message ?? msg;
    details = j?.error?.details;
  } catch {
    /* non-JSON body */
  }
  return new ApiError(res.status, msg, details);
}

// Refresh tokens rotate, so concurrent refreshes must share one request (also covers React StrictMode's double effect).
let refreshing: Promise<Session | null> | null = null;

export function refreshSession(): Promise<Session | null> {
  refreshing ??= (async () => {
    try {
      const res = await send('POST', '/auth/refresh', undefined, false);
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const s = (await res.json()) as Session;
      accessToken = s.accessToken;
      return s;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res = await send(method, path, body);
  if (res.status === 401 && accessToken) {
    if (await refreshSession()) res = await send(method, path, body);
    else onSessionLost?.();
  }
  if (!res.ok) throw await toError(res);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Auth calls: no bearer header and no refresh-retry (a 401 here means bad credentials). */
export async function authRequest<T>(path: string, body?: unknown): Promise<T> {
  const res = await send('POST', path, body, false);
  if (!res.ok) throw await toError(res);
  const data = res.status === 204 ? undefined : await res.json();
  if (data?.accessToken) accessToken = data.accessToken;
  return data as T;
}

export const get = <T>(path: string, params?: Record<string, string | number | undefined>) => {
  const qs = params
    ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString()
    : '';
  return request<T>('GET', qs ? `${path}?${qs}` : path);
};
export const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {});
export const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body);
export const del = <T = void>(path: string) => request<T>('DELETE', path);
