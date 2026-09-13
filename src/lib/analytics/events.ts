export type TrackEvent =
  // Registration hub
  | { name: 'register_started' }
  | { name: 'register_role_selected'; role: 'student' | 'teacher' | 'tutor' | 'school_admin' }
  | { name: 'register_submitted'; role: 'student' | 'teacher' | 'tutor' | 'school_admin' }
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
  | { name: 'school_create_failed'; reason: string }
  // Progress analytics (plan 58). `dataState` and `cellState` are the point of these:
  // four of the five kinds of emptiness are more common than full data today, and which
  // of them teachers actually click decides which survive the next iteration.
  | { name: 'progress_tab_opened'; groupId: string; dataState: ProgressDataState }
  | { name: 'progress_unit_selected'; groupId: string; unitId: string; cellState: CellState }
  | { name: 'progress_context_toggled'; groupId: string; mode: 'all' | 'by_context' }
  | { name: 'heatmap_cell_opened'; groupId: string; unitId: string; cellState: CellState }
  | { name: 'unlinked_unit_link_clicked'; groupId: string; curriculumUnitId: string }
  | { name: 'gap_widget_group_opened'; groupId: string; sort: 'gap' | 'all' };

/** Which of the four pictures screen A was when it opened — `pictureOf()` decides it. */
export type ProgressDataState = 'full' | 'noCourse' | 'noLessons' | 'noAttempts';

/**
 * Restated rather than imported from the kernel mirror: this file is the wire format of
 * the telemetry, and an event whose shape changed because a shared type moved underneath
 * it is an event nobody can compare across two months of data.
 */
export type CellState =
  | 'ok'
  | 'low'
  | 'notStarted'
  | 'insufficient'
  | 'notDelivered'
  | 'unlinked'
  | 'noContent';
