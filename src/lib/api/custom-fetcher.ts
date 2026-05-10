/**
 * Universal fetcher used by orval-generated TanStack Query hooks.
 *
 * On the browser, requests go to the same origin (the BFF in `/api/*`).
 * On the server, the BFF layer (Phase 4) will use a server-side variant
 * that talks to the API Gateway directly.
 *
 * This file is the single integration point with the generated client.
 */

export type ApiRequestConfig<T = unknown> = {
  url: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  params?: Record<string, unknown>;
  data?: T;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
  }
}

export async function customFetcher<TData = unknown, TBody = unknown>(
  config: ApiRequestConfig<TBody>,
): Promise<TData> {
  const url = new URL(
    config.url,
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin,
  );
  if (config.params) {
    for (const [k, v] of Object.entries(config.params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const response = await fetch(url.toString(), {
    method: config.method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
    body: config.data ? JSON.stringify(config.data) : undefined,
    signal: config.signal,
    credentials: 'include',
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    throw new ApiError(response.status, body);
  }

  if (response.status === 204) return undefined as TData;
  return (await response.json()) as TData;
}

export default customFetcher;
