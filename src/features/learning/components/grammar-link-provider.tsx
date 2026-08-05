'use client';

import { createContext, useContext, type ReactNode } from 'react';

/** Grammar rule id → reader href of the page that rule lives on. */
export type GrammarLinks = ReadonlyMap<string, string>;

const EMPTY: GrammarLinks = new Map();

const GrammarLinkContext = createContext<GrammarLinks>(EMPTY);

/**
 * Where each annotated rule can be read in full.
 *
 * A context rather than a prop for the same reason as `GlossaryTargetProvider`:
 * resolving a rule to a page means walking the course's units, which only the
 * page that owns the reader route can do, while the component that needs the
 * answer is a marker deep inside a paragraph.
 *
 * A missing entry is the normal case, not an error — a rule may sit in another
 * course, or in none. Consumers render no link at all rather than a dead one.
 */
export function GrammarLinkProvider({
  links,
  children,
}: {
  links: GrammarLinks;
  children: ReactNode;
}) {
  return <GrammarLinkContext value={links}>{children}</GrammarLinkContext>;
}

export function useGrammarLink(ruleId?: string | null): string | null {
  const links = useContext(GrammarLinkContext);
  return (ruleId && links.get(ruleId)) || null;
}
