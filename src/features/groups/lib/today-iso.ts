/**
 * Today's date as "YYYY-MM-DD" in the user's local timezone — the exact
 * format `<input type="date">` uses for `value`/`min`/`max`, so it's safe
 * to pass directly without further formatting.
 */
export function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
