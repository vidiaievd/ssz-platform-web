export const NOTIFICATIONS_ENABLED = process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS === 'true';

/**
 * Teacher self-declared availability (editor on the teacher schedule page).
 * scheduling-service has no availability CRUD endpoints yet (plan-28 §2.1) —
 * keep gated until the backend ships them.
 */
export const TEACHER_AVAILABILITY_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_TEACHER_AVAILABILITY === 'true';

/**
 * AI-drafted explanations in the gap-fill builder.
 *
 * The generation itself is not built — plan 35 step 7.2 puts the *places* it will
 * attach in the product now, so that adding it later needs no migration: drafts are
 * stored with `origin: 'ai_draft'` from day one, and a draft only becomes an
 * explanation when the teacher accepts it.
 *
 * Off means the controls are absent, not disabled-looking: an author should never meet
 * a button that cannot do anything.
 */
export const GAPFILL_AI_DRAFTS_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_GAPFILL_AI_DRAFTS === 'true';
