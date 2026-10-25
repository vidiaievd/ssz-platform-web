import type { ReviewQueueView } from '../types';

/** Today and the six days before it — "this week" as the inbox says it. */
export const TERM_WEEK_DAYS = 7;

/**
 * The week the inbox talks about, as UTC calendar days (plan 80, steps 7e and 7f).
 *
 * One window for both the line and the list it opens: analytics counts the journal by day,
 * so the list starts at midnight of the first of those days, not seven times 24 hours ago —
 * otherwise a row counted on the line could be missing from the list behind it.
 */
export function termWeek(now: Date): { from: string; to: string; since: string } {
  const day = (date: Date) => date.toISOString().slice(0, 10);
  const from = day(new Date(now.getTime() - (TERM_WEEK_DAYS - 1) * 86_400_000));
  return { from, to: day(now), since: `${from}T00:00:00.000Z` };
}

/** The view as exercise-engine takes it; nothing at all for the ordinary queue. */
export function engineQueueView(
  view: ReviewQueueView | undefined,
  now: Date,
): { view: 'accepted_at_term'; acceptedSince: string } | Record<string, never> {
  return view === 'term' ? { view: 'accepted_at_term', acceptedSince: termWeek(now).since } : {};
}
