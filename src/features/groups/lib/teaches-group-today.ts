/**
 * Whether an assignment still makes its teacher part of the group today. An assignment
 * that ended before today no longer counts; one that starts later does — the rule
 * organization applies when it refuses a second role in a group (`already-in-group`).
 * Dates are days, compared in UTC as the server does.
 */
export function teachesGroupToday(
  assignment: { to?: string | null },
  now: Date = new Date(),
): boolean {
  if (assignment.to == null || assignment.to === '') return true;
  return assignment.to.slice(0, 10) >= now.toISOString().slice(0, 10);
}
