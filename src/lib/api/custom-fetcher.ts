/**
 * Universal fetcher used by orval-generated TanStack Query hooks.
 *
 * Orval's httpClient:'fetch' mutator convention: customFetcher(url, init).
 * On the browser, requests go to the BFF at /api/*.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
  }
}

export async function customFetcher<TData = unknown>(
  url: string,
  init?: RequestInit,
): Promise<TData> {
  const response = await fetch(url, {
    ...init,
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
