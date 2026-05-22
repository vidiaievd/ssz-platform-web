import type { ReactNode } from 'react';

const PLACEHOLDER = '___';

/**
 * Replaces every `___` occurrence in `template` with a bolded `substitution`.
 * Returns an array of React nodes (text + bold spans) so the caller can embed
 * the result inline without dangerouslySetInnerHTML.
 */
export function renderExample(template: string, substitution: string): ReactNode[] {
  const parts = template.split(PLACEHOLDER);
  if (parts.length === 1) {
    // No placeholder found — return the template as-is.
    return [template];
  }

  const nodes: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) nodes.push(part);
    if (i < parts.length - 1) {
      nodes.push(
        <strong key={i} className="font-semibold">
          {substitution}
        </strong>,
      );
    }
  });
  return nodes;
}
