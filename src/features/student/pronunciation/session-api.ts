import { parseItems, parseResult, parseStart, parseTake } from './parse';
import type { SessionBudget, SessionItems, SessionResult, SoundSession, TakeResult } from './types';

/** Why a call was refused: the engine's own code when it gave one. */
export interface Refusal {
  status: number;
  code: string | null;
  retryAfterMs: number | null;
  takeIndex: number | null;
}

export type Call<T> = { ok: true; data: T } | { ok: false; refusal: Refusal };

async function call<T>(
  url: string,
  init: RequestInit | undefined,
  read: (raw: unknown) => T | null,
): Promise<Call<T>> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { ok: false, refusal: { status: 0, code: null, retryAfterMs: null, takeIndex: null } };
  }
  const raw: unknown = await res.json().catch(() => null);
  if (res.ok) {
    const data = read(raw);
    // A 200 this file cannot read is a fault, not a success.
    if (data !== null) return { ok: true, data };
    return { ok: false, refusal: { status: 502, code: 'UNREADABLE', retryAfterMs: null, takeIndex: null } };
  }
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    ok: false,
    refusal: {
      status: res.status,
      code: typeof body.code === 'string' ? body.code : null,
      retryAfterMs: typeof body.retryAfterMs === 'number' ? body.retryAfterMs : null,
      takeIndex: typeof body.takeIndex === 'number' ? body.takeIndex : null,
    },
  };
}

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

/** The pronunciation session's calls to the BFF (plan 86, step 16.1). None of them throws. */
export const soundSessionApi = {
  start: (language: string, atomId?: string): Promise<Call<{ session: SoundSession; budget: SessionBudget | null }>> =>
    call('/api/sound-sessions', json({ language, ...(atomId === undefined ? {} : { atomId }) }), parseStart),

  items: (attemptId: string, locale: string): Promise<Call<SessionItems>> =>
    call(`/api/sound-sessions/${attemptId}/items?locale=${encodeURIComponent(locale)}`, undefined, parseItems),

  take: (
    attemptId: string,
    body: { recordingAssetId: string; takeIndex: number; explanationLanguage: string },
  ): Promise<Call<TakeResult>> => call(`/api/sound-sessions/${attemptId}/takes`, json(body), parseTake),

  submit: (attemptId: string, locale: string): Promise<Call<SessionResult>> =>
    call(`/api/sound-sessions/${attemptId}/submit?locale=${encodeURIComponent(locale)}`, { method: 'POST' }, parseResult),
};

export type SoundSessionApi = typeof soundSessionApi;
