import type { Entitlements } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days left on a trial subscription, or null when there is nothing to announce.
 *
 * Null for the free plan, a paid subscription, a trial without an end (the service refuses
 * one, but an old row is not worth a crash) and a trial already past its end — the refresh
 * job is about to expire it, and "0 days left" would only be noise. A part of a day counts
 * as a whole one, so the last day reads "1 day", never "0".
 */
export function trialDaysLeft(entitlements: Entitlements | null, now: Date): number | null {
  const subscription = entitlements?.subscription;
  if (!subscription || subscription.status !== 'trial' || !subscription.periodEnd) return null;
  const end = Date.parse(subscription.periodEnd);
  if (Number.isNaN(end)) return null;
  const left = end - now.getTime();
  if (left <= 0) return null;
  return Math.ceil(left / DAY_MS);
}
