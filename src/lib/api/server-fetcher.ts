import 'server-only';

import { headers } from 'next/headers';

import { readAccessToken } from '@/lib/auth/cookies';
import { attemptRefresh } from '@/lib/auth/refresh';
import { env } from '@/lib/env';
import { AppError, type AppErrorCode } from '@/lib/errors';

import { resolveServiceUrl, type ServiceName } from './services';

const SENSITIVE_KEYS = /password|token|secret|code|credential|authorization/i;

function redactBody(body: unknown): unknown {
  if (body === null || typeof body !== 'object') return body;
  if (Array.isArray(body)) return body.map(redactBody);
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([k, v]) => [
      k,
      SENSITIVE_KEYS.test(k) ? '[REDACTED]' : redactBody(v),
    ]),
  );
}

function logUpstream(
  direction: '→' | '←' | '✗',
  method: string,
  url: URL,
  extra: { status?: number; durationMs?: number; body?: unknown } = {},
) {
  if (!env.LOG_UPSTREAM_REQUESTS || env.NODE_ENV === 'production') return;

  const parts: string[] = [`[BFF] ${direction}`, ` ${method.padEnd(6)}`, url.toString()];
  if (extra.status !== undefined) parts.splice(2, 0, String(extra.status));
  if (extra.durationMs !== undefined) parts.push(`+${extra.durationMs}ms`);

  const isError = direction === '✗' || (extra.status !== undefined && extra.status >= 400);
  const log = isError ? console.warn : console.log;
  log(parts.join('  '));

  if (extra.body !== undefined) {
    console.log('        body:', JSON.stringify(redactBody(extra.body), null, 2));
  }
}

export type ServerFetchOptions<TBody = unknown> = {
  service: ServiceName;
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: TBody;
  headers?: Record<string, string>;
  /** Skip attaching the access token. Default false. */
  anonymous?: boolean;
  /** Override the default timeout. */
  timeoutMs?: number;
  /** Forward the user agent / accept-language. Default true. */
  forwardClientHeaders?: boolean;
};

export async function serverFetch<TData = unknown, TBody = unknown>(
  opts: ServerFetchOptions<TBody>,
): Promise<TData> {
  const base = resolveServiceUrl(opts.service);
  const url = new URL(`${base}${opts.path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...opts.headers,
  };

  if (opts.forwardClientHeaders !== false) {
    const incoming = await headers();
    const acceptLanguage = incoming.get('accept-language');
    if (acceptLanguage) baseHeaders['Accept-Language'] = acceptLanguage;
  }

  return doRequest(url, baseHeaders, opts, false);
}

async function doRequest<TData, TBody>(
  url: URL,
  baseHeaders: Record<string, string>,
  opts: ServerFetchOptions<TBody>,
  retrying: boolean,
): Promise<TData> {
  const reqHeaders = { ...baseHeaders };

  if (!opts.anonymous) {
    const token = await readAccessToken();
    if (token) reqHeaders.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort('timeout'),
    opts.timeoutMs ?? env.UPSTREAM_TIMEOUT_MS,
  );

  const method = opts.method ?? 'GET';
  const startMs = Date.now();

  logUpstream('→', method, url, { body: opts.body });

  try {
    const response = await fetch(url, {
      method,
      headers: reqHeaders,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });

    const durationMs = Date.now() - startMs;

    if (!response.ok) {
      // Refresh-on-401: one transparent retry with a fresh access token.
      if (response.status === 401 && !opts.anonymous && !retrying) {
        logUpstream('←', method, url, { status: 401, durationMs });
        const refreshed = await attemptRefresh();
        if (refreshed) return doRequest(url, baseHeaders, opts, true);
        throw new AppError('unauthenticated', 'Session expired — refresh failed');
      }

      logUpstream('←', method, url, { status: response.status, durationMs });
      const code = mapStatusToCode(response.status);
      let details: unknown;
      try {
        details = await response.json();
      } catch {
        details = null;
      }
      throw new AppError(code, `Upstream ${response.status} on ${opts.service}${opts.path}`, details);
    }

    logUpstream('←', method, url, { status: response.status, durationMs });

    if (response.status === 204) return undefined as TData;
    return (await response.json()) as TData;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      logUpstream('✗', method, url, { durationMs: Date.now() - startMs });
      throw new AppError('timeout', `Timeout calling ${opts.service}${opts.path}`, null, err);
    }
    logUpstream('✗', method, url, { durationMs: Date.now() - startMs });
    throw new AppError('upstream_unavailable', `Upstream call failed: ${opts.service}${opts.path}`, null, err);
  } finally {
    clearTimeout(timeout);
  }
}

function mapStatusToCode(status: number): AppErrorCode {
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422 || status === 400) return 'validation';
  if (status === 423) return 'mfa_required';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'upstream_unavailable';
  return 'unknown';
}
