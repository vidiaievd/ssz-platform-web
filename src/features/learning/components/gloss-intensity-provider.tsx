'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { GlossIntensity } from '../lib/gloss-intensity';

/** Resolves how strongly one vocabulary item should be marked up. */
export type GlossIntensityResolver = (vocabularyItemId: string) => GlossIntensity;

const DEFAULT_RESOLVER: GlossIntensityResolver = () => 'normal';

const GlossIntensityContext = createContext<GlossIntensityResolver>(DEFAULT_RESOLVER);

export interface GlossIntensityProviderProps {
  resolve: GlossIntensityResolver;
  children: ReactNode;
}

/**
 * Carries the reader's per-word gloss intensity down to `GlossaryText`.
 *
 * A context rather than a prop because the markdown renderer (`LessonProse` →
 * `Blocks`) sits between the page that knows the SRS states and the words that
 * need them; threading a resolver through every block variant would spread
 * reader concerns across a component that only knows about markdown.
 *
 * Surfaces with no provider (the vocabulary card, Storybook) fall back to
 * `normal`, which is also the right answer while card states are still loading.
 */
export function GlossIntensityProvider({ resolve, children }: GlossIntensityProviderProps) {
  return <GlossIntensityContext value={resolve}>{children}</GlossIntensityContext>;
}

export function useGlossIntensity(vocabularyItemId: string): GlossIntensity {
  return useContext(GlossIntensityContext)(vocabularyItemId);
}
