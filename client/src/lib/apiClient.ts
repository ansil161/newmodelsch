import { env } from '@/config/env';
import type { ApiFailure, ApiSuccess } from '@/types/api';

/* ==========================================================================
   API CLIENT
   --------------------------------------------------------------------------
   The one way the app talks to the backend.

   CREDENTIALS ARE COOKIES THIS CODE CANNOT SEE.
   Sign-in sets an access and a refresh JWT as HttpOnly cookies. Every request
   carries them (`credentials: 'include'`); nothing here reads, stores or
   attaches a token. There is no token in memory, in localStorage or in a
   header, so a script injected into the page has nothing to steal.

   UNSAFE REQUESTS CARRY A CSRF TOKEN.
   Cookies ride along on a forged cross-site request too, so every non-GET
   sends X-CSRFToken. The token comes from GET /auth/csrf/ and is held in
   memory. The server rotates it at sign-in and sign-out; a 403 `csrf_failed`
   fetches a fresh one and retries once.

   A 401 IS ANSWERED WITH ONE REFRESH, NOT MANY.
   Every request that fails with 401 at the same moment waits on a single
   POST /auth/refresh/ and is retried once. Tabs share one cookie jar, so the
   Web Locks API serialises refreshes across tabs as well: the backend treats
   a refresh token presented twice as stolen. If the refresh fails, the
   session-expired handler runs and the request fails - no loop.
   ========================================================================== */

/**
 * VITE_API_BASE_URL is the versioned API root, e.g.
 * https://api.example.com/api/v1. Unset, requests stay on the site's own
 * origin under /api/v1 - the Vite dev server proxies it.
 */
const API_ROOT = (env.apiBaseUrl || '/api/v1').replace(/\/+$/, '');
const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const REFRESH_LOCK = 'nmhs-auth-refresh';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string[]>;

  constructor(status: number, code: string, message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
  /** For the auth endpoints themselves: their 401 is an answer, not a cue to refresh. */
  skipRefresh?: boolean;
}

/** What GET /auth/csrf/ returns. */
export interface SessionBootstrap {
  csrf_token: string;
  captcha: { enabled: boolean; provider: string | null; site_key: string };
}

let bootstrapRequest: Promise<SessionBootstrap> | null = null;
let refreshRequest: Promise<boolean> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

/** The CSRF token and public login configuration - fetched once, shared by every caller. */
export function getSessionBootstrap(): Promise<SessionBootstrap> {
  if (!bootstrapRequest) {
    const request = send<SessionBootstrap>('/auth/csrf/', { skipRefresh: true });
    bootstrapRequest = request;
    // A failed fetch is not cached: the next caller tries again.
    request.catch(() => {
      if (bootstrapRequest === request) bootstrapRequest = null;
    });
  }
  return bootstrapRequest;
}

/** Forget the CSRF token. Call after sign-in and sign-out, where the server rotates it. */
export function resetCsrfToken(): void {
  bootstrapRequest = null;
}

/** Called when a session cannot be refreshed. The auth provider registers one. */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

/** Exchange the refresh cookie for new cookies. Resolves false when the session is over. */
export function refreshSession(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = withRefreshLock(async () => {
      try {
        await send('/auth/refresh/', { method: 'POST', skipRefresh: true });
        return true;
      } catch {
        return false;
      }
    }).finally(() => {
      refreshRequest = null;
    });
  }
  return refreshRequest;
}

function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) return task();
  return new Promise<T>((resolve, reject) => {
    navigator.locks.request(REFRESH_LOCK, () => task().then(resolve, reject)).catch(reject);
  });
}

interface Retried {
  csrf: boolean;
  auth: boolean;
}

async function send<T>(path: string, options: RequestOptions, retried: Retried = { csrf: false, auth: false }): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') headers['X-CSRFToken'] = (await getSessionBootstrap()).csrf_token;

  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      signal: options.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', GENERIC_MESSAGE);
  }

  const payload = await readJson(response);
  if (response.ok && isSuccess<T>(payload)) return payload.data;

  const error = toApiError(response.status, payload);

  if (error.code === 'csrf_failed' && !retried.csrf) {
    resetCsrfToken();
    return send<T>(path, options, { ...retried, csrf: true });
  }

  if (response.status === 401 && !options.skipRefresh && !retried.auth) {
    if (await refreshSession()) return send<T>(path, options, { ...retried, auth: true });
    sessionExpiredHandler?.();
  }

  throw error;
}

async function readJson(response: Response): Promise<unknown> {
  if (!(response.headers.get('Content-Type') ?? '').includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isSuccess<T>(value: unknown): value is ApiSuccess<T> {
  return typeof value === 'object' && value !== null && (value as ApiSuccess<T>).success === true;
}

function isFailure(value: unknown): value is ApiFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ApiFailure).success === false &&
    typeof (value as ApiFailure).code === 'string'
  );
}

/** Only the envelope's own fields become an error. A proxy's HTML error page never reaches the UI. */
function toApiError(status: number, payload: unknown): ApiError {
  if (isFailure(payload)) {
    const message = typeof payload.message === 'string' ? payload.message : GENERIC_MESSAGE;
    return new ApiError(status, payload.code, message, fieldErrors(payload.errors));
  }
  return new ApiError(status, status >= 500 ? 'server_error' : 'unexpected_response', GENERIC_MESSAGE);
}

function fieldErrors(value: unknown): Record<string, string[]> {
  if (typeof value !== 'object' || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).map(([field, messages]) => [
      field,
      Array.isArray(messages) ? messages.map(String) : [String(messages)],
    ]),
  );
}

/** The full URL of an API path, for links the browser follows itself — a download. */
export function apiUrl(path: string): string {
  return `${API_ROOT}${path}`;
}

/* --------------------------------------------------------------------------
   UPLOADS
   XMLHttpRequest rather than fetch, for one reason: fetch reports no upload
   progress, and a 20 MB handbook on a school connection is a long enough wait
   that a still screen reads as broken. Everything else is the same as `send`:
   the cookies, the CSRF token, the envelope, the one refresh on a 401.
   -------------------------------------------------------------------------- */

export interface UploadOptions {
  signal?: AbortSignal;
  /** 0 to 1, as the body leaves the browser. */
  onProgress?: (fraction: number) => void;
}

export async function upload<T>(
  path: string,
  form: FormData,
  options: UploadOptions = {},
  retried: Retried = { csrf: false, auth: false },
): Promise<T> {
  const csrf = (await getSessionBootstrap()).csrf_token;
  const { status, payload } = await sendForm(`${API_ROOT}${path}`, form, csrf, options);
  if (status >= 200 && status < 300 && isSuccess<T>(payload)) return payload.data;

  const error = toApiError(status, payload);
  if (error.code === 'csrf_failed' && !retried.csrf) {
    resetCsrfToken();
    return upload<T>(path, form, options, { ...retried, csrf: true });
  }
  if (status === 401 && !retried.auth) {
    if (await refreshSession()) return upload<T>(path, form, options, { ...retried, auth: true });
    sessionExpiredHandler?.();
  }
  throw error;
}

function sendForm(
  url: string,
  form: FormData,
  csrf: string,
  { signal, onProgress }: UploadOptions,
): Promise<{ status: number; payload: unknown }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('X-CSRFToken', csrf);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let payload: unknown = null;
      if ((xhr.getResponseHeader('Content-Type') ?? '').includes('application/json')) {
        try {
          payload = JSON.parse(xhr.responseText);
        } catch {
          payload = null;
        }
      }
      resolve({ status: xhr.status, payload });
    };
    xhr.onerror = () => reject(new ApiError(0, 'network_error', GENERIC_MESSAGE));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

/* --------------------------------------------------------------------------
   SERVER-SENT EVENTS
   Not EventSource: it can only GET, and cannot send a body or a CSRF header.
   The frames are parsed here with the parts of the SSE format that matter — a
   blank line ends a frame, `event:` names it, `data:` lines join, a line that
   starts with `:` is a comment — and each is yielded the moment it arrives.
   -------------------------------------------------------------------------- */

export interface StreamEvent {
  event: string;
  data: unknown;
}

export async function* streamEvents(
  path: string,
  body: unknown,
  options: { signal?: AbortSignal } = {},
): AsyncGenerator<StreamEvent> {
  const response = await openStream(path, body, options.signal);
  if (!response.body) throw new ApiError(0, 'network_error', GENERIC_MESSAGE);

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value.replace(/\r\n/g, '\n');
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = parseFrame(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (frame) yield frame;
        boundary = buffer.indexOf('\n\n');
      }
    }
  } finally {
    // Reached when the reader stops early too: cancelling closes the
    // connection, which is what stops the answer being generated server-side.
    await reader.cancel().catch(() => undefined);
  }
}

async function openStream(
  path: string,
  body: unknown,
  signal: AbortSignal | undefined,
  retried: Retried = { csrf: false, auth: false },
): Promise<Response> {
  const csrf = (await getSessionBootstrap()).csrf_token;
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      signal,
      headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'network_error', GENERIC_MESSAGE);
  }
  if (response.ok) return response;

  const error = toApiError(response.status, await readJson(response));
  if (error.code === 'csrf_failed' && !retried.csrf) {
    resetCsrfToken();
    return openStream(path, body, signal, { ...retried, csrf: true });
  }
  if (response.status === 401 && !retried.auth) {
    if (await refreshSession()) return openStream(path, body, signal, { ...retried, auth: true });
    sessionExpiredHandler?.();
  }
  throw error;
}

function parseFrame(frame: string): StreamEvent | null {
  let event = 'message';
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    const value = separator === -1 ? '' : line.slice(separator + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join('\n')) as unknown };
  } catch {
    return null;
  }
}

type Options = Omit<RequestOptions, 'method' | 'body'>;

export const api = {
  get: <T>(path: string, options?: Options) => send<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Options) => send<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Options) => send<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Options) => send<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Options) => send<T>(path, { ...options, method: 'DELETE' }),
};
