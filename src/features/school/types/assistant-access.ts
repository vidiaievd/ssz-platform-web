/**
 * Which students the school's assistant answers on the school's account (plan 83, Q6).
 * A student outside the choice is not refused — they ask on their own plan.
 */
export type AssistantMode = 'off' | 'all_students' | 'selected_groups' | 'selected_students';

/** As organization-service keeps it: both lists travel with every mode. */
export interface AssistantAccess {
  mode: AssistantMode;
  groupIds: string[];
  studentIds: string[];
}

/** What the two lists on the settings screen can offer. */
export interface AssistantAccessChoices {
  groups: { id: string; name: string; studentCount: number }[];
  students: { userId: string; name: string; email: string | null }[];
}
