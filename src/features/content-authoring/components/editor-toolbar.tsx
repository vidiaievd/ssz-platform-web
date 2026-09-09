'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * The strip along the top of the editor that belongs to whatever is being edited —
 * in practice the step rail of a builder, with its save hint and its Done button.
 *
 * It lives in `LessonEditorShell`'s bar so that it spans the workspace and lines up
 * with the preview panel beside it, but only the builder knows what its steps are or
 * which one is open. So the shell offers the place and the builder fills it.
 */
const EditorToolbarContext = createContext<HTMLElement | null>(null);

export function EditorToolbarProvider({
  element,
  children,
}: {
  element: HTMLElement | null;
  children: ReactNode;
}) {
  return <EditorToolbarContext.Provider value={element}>{children}</EditorToolbarContext.Provider>;
}

/** The element to render the toolbar into, and the ref that registers it. */
export function useEditorToolbarTarget(): [HTMLElement | null, (node: HTMLElement | null) => void] {
  const [element, setElement] = useState<HTMLElement | null>(null);
  return [element, setElement];
}

/**
 * Renders the builder's toolbar into the shell's bar — or in place, when there is no
 * shell around it. The fallback is what keeps a builder rendered on its own, in a
 * test or a story, from losing its steps entirely.
 */
export function EditorToolbarPortal({ children }: { children: ReactNode }) {
  const element = useContext(EditorToolbarContext);

  return element === null ? <>{children}</> : createPortal(children, element);
}
