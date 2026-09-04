'use client';

import { createContext, useContext, type ReactNode } from 'react';

/**
 * Which course the open builder belongs to — plan 56 §3.8, phase 6.
 *
 * Ambient rather than a prop because it is a fact about the screen and not about any one
 * control: the editor pane knows it, and the alternative was threading the same string
 * through nine builders and every step component that happens to render a card needing it.
 *
 * It exists for the audio layer's `lesson` source, which offers the lessons of this course
 * to borrow a recording from. Anything else that needs to know where it is may read it.
 *
 * `null` outside a provider — a preview, a test, a builder mounted on its own — and every
 * reader treats that as "cannot offer what needs a course", never as an error.
 */
const AuthoringContainerContext = createContext<string | null>(null);

export function AuthoringContainerProvider({
  containerId,
  children,
}: {
  containerId: string;
  children: ReactNode;
}) {
  return (
    <AuthoringContainerContext.Provider value={containerId}>
      {children}
    </AuthoringContainerContext.Provider>
  );
}

/** The course the builder is editing in, or `null` where nothing said. */
export function useAuthoringContainerId(): string | null {
  return useContext(AuthoringContainerContext);
}
