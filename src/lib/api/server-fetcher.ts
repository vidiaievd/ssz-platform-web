import 'server-only';

import { headers } from 'next/headers';

import { readAccessToken } from '@/lib/auth/cookies';
import { attemptRefresh } from '@/lib/auth/refresh';
import { env } from '@/lib/env';
import { AppError, type AppErrorCode } from '@/lib/errors';

import { resolveServiceUrl, type ServiceName } from './services';

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

  try {
    const response = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: reqHeaders,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      // Refresh-on-401: one transparent retry with a fresh access token.
      if (response.status === 401 && !opts.anonymous && !retrying) {
        const refreshed = await attemptRefresh();
        if (refreshed) return doRequest(url, baseHeaders, opts, true);
        throw new AppError('unauthenticated', 'Session expired — refresh failed');
      }

      const code = mapStatusToCode(response.status);
      let details: unknown;
      try {
        details = await response.json();
      } catch {
        details = null;
      }
      throw new AppError(code, `Upstream ${response.status} on ${opts.service}${opts.path}`, details);
    }

    if (response.status === 204) return undefined as TData;
    return (await response.json()) as TData;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AppError('timeout', `Timeout calling ${opts.service}${opts.path}`, null, err);
    }
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
