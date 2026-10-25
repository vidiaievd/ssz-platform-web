import type { ReviewBlockOccurrence } from '@/lib/scheduling/provider';

/**
 * When the queue counts as "noticeably more" than the time held for it (plan 81, step 8):
 * a quarter over, and at least half an hour over. The norms are medians and guesses, so a
 * queue a few minutes over the held time is not a signal; neither is half an hour of work
 * against nothing held, which a teacher clears between lessons.
 */
export const OVERLOAD_RATIO = 1.25;
export const OVERLOAD_MIN_HOURS = 0.5;

/** exercise-engine's `review/effort`, as far as the forecast reads it. */
export interface ReviewEffort {
  pending: { groupId: string | null; templateCode: string; count: number }[];
  norms: { templateCode: string; minutesPerSubmission: number }[];
}

export interface QueueForecast {
  /** Submissions waiting in the teacher's groups. */
  pending: number;
  /** What they take at the school's norms, in hours. */
  hoursNeeded: number;
  /** Marking time held from `from` to the end of the window, in hours. */
  hoursHeld: number;
  /**
   * Some of the work sits in a group the teacher reviews with somebody else, and counts in
   * both queues — as the oversight screen counts it (plan 46 §46.1). The figure is what
   * the teacher may have to read, not what they will.
   */
  shared: boolean;
  overloaded: boolean;
}

/**
 * The teacher's queue against the time they hold for it.
 *
 * The queue is today's, the held time runs from `from` to `to`: the work waiting now has
 * to be done in what is left of the week, and a sitting already behind the teacher marks
 * nothing of it.
 */
export function queueForecast(input: {
  effort: ReviewEffort;
  /** Groups the teacher reviews right now, each with how many reviewers it has. */
  reviewersByGroup: Map<string, number>;
  occurrences: ReviewBlockOccurrence[];
  from: string;
  to: string;
}): QueueForecast {
  // The engine names a norm for every template in its queue; a missing one would be a
  // contract break, and counting it as nothing would show a lighter week than there is.
  const norms = new Map(input.effort.norms.map((n) => [n.templateCode, n.minutesPerSubmission]));

  let pending = 0;
  let minutesNeeded = 0;
  let shared = false;
  for (const bucket of input.effort.pending) {
    if (bucket.groupId === null) continue;
    const reviewers = input.reviewersByGroup.get(bucket.groupId);
    if (reviewers === undefined) continue;

    const norm = norms.get(bucket.templateCode);
    if (norm === undefined) {
      throw new Error(`No review norm for template "${bucket.templateCode}"`);
    }
    pending += bucket.count;
    minutesNeeded += bucket.count * norm;
    if (reviewers > 1) shared = true;
  }

  let minutesHeld = 0;
  for (const occurrence of input.occurrences) {
    if (occurrence.date < input.from || occurrence.date > input.to) continue;
    minutesHeld += toMinutes(occurrence.end) - toMinutes(occurrence.start);
  }

  const hoursNeeded = minutesNeeded / 60;
  const hoursHeld = minutesHeld / 60;

  return {
    pending,
    hoursNeeded: round(hoursNeeded),
    hoursHeld: round(hoursHeld),
    shared,
    overloaded:
      hoursNeeded > hoursHeld * OVERLOAD_RATIO && hoursNeeded - hoursHeld >= OVERLOAD_MIN_HOURS,
  };
}

function round(hours: number): number {
  return Math.round(hours * 10) / 10;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}
