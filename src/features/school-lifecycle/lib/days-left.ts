const DAY_MS = 86_400_000;

/** Whole days from `now` to `iso`, rounded up and never below 0; `null` without a date. */
export function daysLeft(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.ceil((t - now.getTime()) / DAY_MS));
}
