/**
 * The arithmetic behind the oversight screen — attribution and medians, and nothing else.
 *
 * Pure on purpose. Everything that makes the screen expensive (four services, names,
 * promises) lives in the route; what makes it *right* is here, where it can be tested at
 * its edges: a queue attributed to two reviewers, a school with no promise, a period in
 * which nobody answered anything.
 *
 * The vocabulary matches the rest of the subsystem: hours are hours since the submission
 * (`hoursSince`), a promise is `slaHours`, and "past the promise" is `isOverdue` — one
 * formula for urgency across the product (plan 44 §0.1).
 */

import { isOverdue } from './age-scale';

/** What is waiting in one course for one group, as ages in hours. */
export interface PendingBucket {
  containerId: string | null;
  groupId: string | null;
  /** One entry per waiting submission. */
  ages: number[];
}

/** How long one reviewer took over one course and group, per verdict. */
export interface ReviewedBucket {
  reviewerId: string;
  containerId: string | null;
  groupId: string | null;
  durationsHours: number[];
}

/** The three numbers every row of the screen is drawn from. */
export interface LoadTally {
  pending: number;
  overdue: number;
  ages: number[];
}

/**
 * The middle value, or null when there is nothing to take the middle of.
 *
 * A median rather than a mean everywhere in this screen. Answering times are a long-tailed
 * quantity — most within a day, a few after a holiday — and an average of those describes
 * neither group. An even count takes the mean of the two middle values, which is the
 * ordinary definition and keeps the figure stable as one more verdict lands.
 */
export function median(values: readonly number[]): number | null {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;

  const sorted = [...finite].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** An empty tally — the starting point of every accumulation below. */
function empty(): LoadTally {
  return { pending: 0, overdue: 0, ages: [] };
}

/**
 * Fold a bucket into a tally, counting lateness against *that bucket's* promise.
 *
 * Lateness has to be decided before the ages are merged: a school's queue crosses courses,
 * a course may promise 24 hours where the school promises 48, and a tally that kept only
 * the ages could not tell afterwards which scale each of them belonged to.
 */
function absorb(tally: LoadTally, bucket: PendingBucket, slaHours: number | null): void {
  for (const age of bucket.ages) {
    tally.pending += 1;
    tally.ages.push(age);
    if (slaHours !== null && isOverdue(age, slaHours)) tally.overdue += 1;
  }
}

/**
 * Tally the waiting work under whatever keys each bucket belongs to.
 *
 * `keysOf` returns a list rather than one key because a bucket genuinely belongs to
 * several rows at once: a group with two reviewers puts every submission in both their
 * queues, and that is the truth about their load rather than a bookkeeping artefact
 * (plan 46 §46.1 item 4). The school's summary is built from the buckets directly instead,
 * so the same submission is counted once there and once per reviewer here — a difference
 * the screen names in the row's caption.
 *
 * A bucket whose `keysOf` is empty falls out entirely: no reviewer, no group, no row. Those
 * submissions are the `unassigned` list, which the screen shows by name rather than as a
 * bar in a chart.
 */
export function tallyLoad(
  buckets: readonly PendingBucket[],
  keysOf: (bucket: PendingBucket) => string[],
  slaFor: (containerId: string | null) => number | null,
): Map<string, LoadTally> {
  const tallies = new Map<string, LoadTally>();

  for (const bucket of buckets) {
    const slaHours = slaFor(bucket.containerId);
    for (const key of keysOf(bucket)) {
      let tally = tallies.get(key);
      if (!tally) {
        tally = empty();
        tallies.set(key, tally);
      }
      absorb(tally, bucket, slaHours);
    }
  }

  return tallies;
}

/**
 * The school as a whole: every waiting submission counted exactly once.
 *
 * Built from the buckets and not from the teacher rows, precisely because those double
 * count on purpose. Two reviewers on one group is a doubled workload and a single queue.
 */
export function tallySchool(
  buckets: readonly PendingBucket[],
  slaFor: (containerId: string | null) => number | null,
): LoadTally {
  const tally = empty();
  for (const bucket of buckets) absorb(tally, bucket, slaFor(bucket.containerId));
  return tally;
}

/**
 * How long each reviewer took, over the whole period, in one list per reviewer.
 *
 * Kept apart from the pending tally because they answer different questions and come from
 * different halves of the aggregate: what is waiting now, and how fast this person has been
 * answering. A teacher with an empty queue and a two-hour median is doing well; the same
 * median with forty waiting is a person about to fall behind.
 */
export function durationsByReviewer(buckets: readonly ReviewedBucket[]): Map<string, number[]> {
  const byReviewer = new Map<string, number[]>();

  for (const bucket of buckets) {
    const durations = byReviewer.get(bucket.reviewerId);
    if (durations) durations.push(...bucket.durationsHours);
    else byReviewer.set(bucket.reviewerId, [...bucket.durationsHours]);
  }

  return byReviewer;
}

/**
 * Whether any of the work attributed to this reviewer is also attributed to someone else.
 *
 * Drives one caption and nothing else, but it is the caption that keeps the screen honest:
 * without it, the teacher rows add up to more than the school's total and an administrator
 * is left to guess which number is wrong.
 */
export function sharesLoad(
  buckets: readonly PendingBucket[],
  reviewersOf: (bucket: PendingBucket) => string[],
  reviewerId: string,
): boolean {
  return buckets.some((bucket) => {
    if (bucket.ages.length === 0) return false;
    const reviewers = reviewersOf(bucket);
    return reviewers.length > 1 && reviewers.includes(reviewerId);
  });
}
