export const NOTIFICATIONS_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_NOTIFICATIONS === 'true';

/**
 * Teacher self-declared availability (editor on the teacher schedule page).
 * scheduling-service has no availability CRUD endpoints yet (plan-28 §2.1) —
 * keep gated until the backend ships them.
 */
export const TEACHER_AVAILABILITY_ENABLED =
  process.env.NEXT_PUBLIC_FEATURE_TEACHER_AVAILABILITY === 'true';
