/**
 * Converts a human-readable string into a URL-safe kebab-case slug.
 * Strips diacritics (ä→a, é→e), removes non-ASCII/non-alphanumeric chars,
 * collapses whitespace to hyphens. Max 60 chars per spec.
 */
export function slugify(input: string, maxLength = 60): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')   // strip combining diacritics
    .replace(/[^\w\s-]/g, '')           // remove remaining non-word chars
    .trim()
    .replace(/[\s_]+/g, '-')            // whitespace / underscores → hyphens
    .replace(/-+/g, '-')                // collapse consecutive hyphens
    .replace(/^-|-$/g, '')              // trim leading/trailing hyphens
    .slice(0, maxLength);
}
