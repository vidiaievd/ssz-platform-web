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

interface SrsCard {
  id: string;
  state: string;
}

async function postSrs<T>(
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.ok ? ((await res.json().catch(() => null)) as T | null) : null;
  return { ok: res.ok, status: res.status, data };
}

function introduce(vocabularyItemId: string) {
  return postSrs<SrsCard>('/api/srs/cards/introduce', {
    contentType: 'VOCABULARY_WORD',
    contentId: vocabularyItemId,
  });
}

/**
 * Puts a translated word into review. Idempotent server-side; past the day's new-card
 * budget it is refused (429), which is not an error here — the word joins on a later day.
 * A word deleted earlier had its card suspended; added again, it comes back with its history.
 */
export async function introduceWord(vocabularyItemId: string): Promise<void> {
  const result = await introduce(vocabularyItemId);
  if (!result.ok) {
    if (result.status !== 429) throw new MyWordsError(result.status, null);
    return;
  }
  if (result.data?.state?.toUpperCase() === 'SUSPENDED') {
    await postSrs(`/api/srs/cards/${result.data.id}/unsuspend`);
  }
}

/**
 * Takes a word out of «My words». A word of the student's own also leaves review — its card
 * is suspended, not deleted, so adding the word again restores its history. A course word
 * keeps its card: the course put it in review, not the student.
 */
export async function removeMyWord(word: PersonalWord): Promise<void> {
  await deleteMyWord(word.entryId);
  if (!word.ownWord) return;

  const states = await postSrs<{ states: { contentId: string; state: string }[] }>(
    '/api/learning/srs/card-states',
    { contentType: 'VOCABULARY_WORD', contentIds: [word.vocabularyItemId] },
  );
  const state = states.data?.states[0];
  if (!state || state.state.toUpperCase() === 'SUSPENDED') return;

  // Introducing an existing card hands it back without touching the new-card budget.
  const card = await introduce(word.vocabularyItemId);
  if (card.data) await postSrs(`/api/srs/cards/${card.data.id}/suspend`);
}
