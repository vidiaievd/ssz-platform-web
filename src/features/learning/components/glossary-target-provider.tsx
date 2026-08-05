'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Where a word lookup lands.
 *
 * `popover` — the full card opens over the text, the only option when there is
 * nowhere else to put it.
 * `panel` — the click updates a card living outside the prose (the reader's
 * rail); the popover then never opens beyond its hover hint.
 *
 * This is a context rather than a prop because the decision belongs to the page
 * that owns the layout, while the component that acts on it is a word deep
 * inside a paragraph — the same reason `GlossIntensityProvider` exists.
 */
export type GlossaryTarget = 'popover' | 'panel';

const GlossaryTargetContext = createContext<GlossaryTarget>('popover');

export function GlossaryTargetProvider({
  target,
  children,
}: {
  target: GlossaryTarget;
  children: ReactNode;
}) {
  return <GlossaryTargetContext value={target}>{children}</GlossaryTargetContext>;
}

export function useGlossaryTarget(): GlossaryTarget {
  return useContext(GlossaryTargetContext);
}
