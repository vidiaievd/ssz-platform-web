/**
 * Whether the school's learners may have a model check their work before handing it in, and
 * how often (plan 84). `null` limits mean «no limit of the school's own» — the plan's pool and
 * its per-learner ceiling still apply.
 */
export interface AiPrecheckSettings {
  enabled: boolean;
  /** Checks per learner and exercise, over all time. */
  perExerciseLimit: number | null;
  /** Credits per learner and calendar month. */
  perLearnerMonthlyCredits: number | null;
}
