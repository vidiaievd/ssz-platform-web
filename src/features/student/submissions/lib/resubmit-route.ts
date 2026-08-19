/**
 * Where a second attempt happens (plan 47.3).
 *
 * The mock for screen E puts a text field in the card, and for an essay that is right: the
 * work is one piece of prose, the teacher's comment is about that prose, and sending the
 * learner to another screen to rewrite it would separate the two things that must be read
 * together. But four templates reach a teacher, and only one of them is a text field.
 * `translate_*` is a sentence per item with its own keyboard pad; `error_correction` is a
 * hunt through a text with a self-check budget; `short_answer` is a question with a
 * reference the runner marks against. Those are the runner's screens, and reproducing any
 * of them inside a list row would be building a second, worse copy of it.
 *
 * So the fork is by shape, not by convenience: a template whose submission is one piece of
 * text is redone where it came back, everything else is handed back to the runner it was
 * typed in — with the teacher's comment carried above the exercise so the learner corrects
 * while looking at the remark.
 */

/** Templates whose whole submission is one block of text the learner writes. */
const IN_PLACE_TEMPLATES = new Set(['writing_task']);

export type ResubmitMode = 'in-place' | 'runner';

export function resubmitModeFor(exerciseType: string): ResubmitMode {
  return IN_PLACE_TEMPLATES.has(exerciseType) ? 'in-place' : 'runner';
}

/**
 * The runner, told where the learner is coming from. Locale-less: the localised `Link`
 * prefixes it, the same as every other in-app href.
 *
 * `from=submission` is what makes the banner appear at all, and `attempt` names the
 * verdict it shows. Both live in the URL rather than in navigation state so that the
 * second attempt survives a reload — a comment that disappears on refresh is a comment the
 * learner has to go back and find.
 */
export function runnerHref(submission: { exerciseId: string; id: string }): string {
  const query = new URLSearchParams({ from: 'submission', attempt: submission.id });
  return `/student/exercises/${submission.exerciseId}?${query.toString()}`;
}
