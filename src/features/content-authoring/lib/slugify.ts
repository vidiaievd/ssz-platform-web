/** Derives a URL-safe slug preview from a course title (informational only — the backend assigns the real slug on first publish). */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
