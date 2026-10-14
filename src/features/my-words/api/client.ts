import type { CaptureWordInput, PersonalWord, WordLookup } from '../types';

/** A refusal from the BFF, carrying content-service's own code (INVALID_SURFACE_FORM…). */
export class MyWordsError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
  ) {
    super(code ?? `HTTP ${status}`);
    this.name = 'MyWordsError';
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new MyWordsError(res.status, body?.error ?? null);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function fetchMyWords(translationLanguage: string): Promise<PersonalWord[]> {
  return request(`/api/personal-vocabulary?${new URLSearchParams({ translationLanguage })}`);
}

export function fetchWordLookup(params: {
  targetLanguage: string;
  translationLanguage: string;
  form: string;
}): Promise<WordLookup> {
  return request(`/api/personal-vocabulary/lookup?${new URLSearchParams(params)}`);
}

export function postCaptureWord(
  input: CaptureWordInput,
): Promise<{ word: PersonalWord; created: boolean }> {
  return request('/api/personal-vocabulary', { method: 'POST', body: JSON.stringify(input) });
}

export function patchMyWord(
  entryId: string,
  body: { translationLanguage: string; translation?: string; word?: string },
): Promise<PersonalWord> {
  return request(`/api/personal-vocabulary/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteMyWord(entryId: string): Promise<void> {
  return request(`/api/personal-vocabulary/${entryId}`, { method: 'DELETE' });
}

/**
 * Puts a translated word into review. Idempotent server-side; past the day's new-card
 * budget it is refused (429), which is not an error here — the word joins on a later day.
 */
export async function introduceWord(vocabularyItemId: string): Promise<void> {
  const res = await fetch('/api/srs/cards/introduce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contentType: 'VOCABULARY_WORD', contentId: vocabularyItemId }),
  });
  if (!res.ok && res.status !== 429) throw new MyWordsError(res.status, null);
}
