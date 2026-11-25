/**
 * Whether a teacher fits a group's language — the rule organization applies when it
 * assigns a teacher (`language-mismatch`): a teacher who listed languages must list the
 * group's; one who listed none is not checked, the server admits them, so they are not
 * marked as a mismatch here either (a dimmed "language mismatch" claimed a fact nobody knew).
 */
export function fitsGroupLanguage(teacherLangs: readonly string[], groupLang: string): boolean {
  if (teacherLangs.length === 0) return true;
  return teacherLangs.some((l) => l.toLowerCase() === groupLang.toLowerCase());
}
