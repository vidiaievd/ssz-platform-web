export type TrackEvent =
  // Registration hub
  | { name: 'register_started' }
  | { name: 'register_role_selected'; role: 'student' | 'tutor' | 'school_admin' }
  | { name: 'register_submitted'; role: 'student' | 'tutor' | 'school_admin' }
  | { name: 'register_email_conflict' }
  // Email verification
  | { name: 'verify_opened' }
  | { name: 'verify_succeeded' }
  | { name: 'verify_failed'; code: string }
  | { name: 'verify_resent' }
  // Onboarding flow
  | { name: 'onboarding_started'; role: 'student' | 'tutor' }
  | { name: 'onboarding_step_completed'; step: string }
  | { name: 'onboarding_finished'; role: 'student' | 'tutor' }
  // School creation wizard
  | { name: 'school_create_started' }
  | { name: 'school_create_succeeded' }
  | { name: 'school_create_failed'; reason: string };
