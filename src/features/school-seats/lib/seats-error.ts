import { SEATS_EXHAUSTED, type SeatUsage } from '../types';

/**
 * Reads the `SEATS_EXHAUSTED` body organization-service sends with its 409:
 * `{ error: { code, message, seats } }`. Anything else (a plain conflict such as "already a
 * member", a malformed body) is `null`, so callers keep their own conflict handling.
 */
export function seatsFromConflictBody(body: unknown): SeatUsage | null {
  const error = (body as { error?: { code?: unknown; seats?: unknown } } | null | undefined)?.error;
  if (!error || error.code !== SEATS_EXHAUSTED) return null;
  const seats = error.seats as Partial<SeatUsage> | undefined;
  if (!seats || typeof seats.used !== 'number') return null;
  return {
    used: seats.used,
    limit: typeof seats.limit === 'number' ? seats.limit : null,
    ceiling: typeof seats.ceiling === 'number' ? seats.ceiling : null,
    state: 'full',
  };
}

/** True when an error (AppError with `details`, or a plain object body) is the seats refusal. */
export function isSeatsExhausted(error: unknown): boolean {
  const details = (error as { details?: unknown } | null | undefined)?.details;
  return seatsFromConflictBody(details) !== null;
}

/** What the BFF routes answer the browser with on a seats refusal. */
export function seatsExhaustedResponseBody(error: unknown): { error: string; code: string; seats: SeatUsage } | null {
  const seats = seatsFromConflictBody((error as { details?: unknown } | null | undefined)?.details);
  return seats ? { error: 'Seats exhausted', code: SEATS_EXHAUSTED, seats } : null;
}
