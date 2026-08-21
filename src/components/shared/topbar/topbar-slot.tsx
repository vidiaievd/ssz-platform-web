'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * A place in the app's top bar that a page can fill.
 *
 * Pages cannot reach the bar — the layout renders it, and what belongs there is
 * often something only the page knows (where this material sits in its course, for
 * one). A portal lets the page render into the bar from where its data is, without
 * the layout having to learn about every route.
 */
interface TopbarSlotApi {
  element: HTMLElement | null;
  setElement: (element: HTMLElement | null) => void;
  /** Registers a filler, so the slot knows to drop its fallback. Returns the unregister. */
  claim: () => () => void;
  claimed: boolean;
}

const TopbarSlotContext = createContext<TopbarSlotApi>({
  element: null,
  setElement: () => {},
  claim: () => () => {},
  claimed: false,
});

export function TopbarSlotProvider({ children }: { children: ReactNode }) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [claims, setClaims] = useState(0);

  const claim = useCallback(() => {
    setClaims((count) => count + 1);
    return () => setClaims((count) => count - 1);
  }, []);

  return (
    <TopbarSlotContext.Provider value={{ element, setElement, claim, claimed: claims > 0 }}>
      {children}
    </TopbarSlotContext.Provider>
  );
}

/** The slot itself, rendered inside the bar. Shows `fallback` while no page fills it. */
export function TopbarSlot({ fallback }: { fallback?: ReactNode }) {
  const { setElement, claimed } = useContext(TopbarSlotContext);

  return (
    <div ref={setElement} className="flex min-w-0 flex-1 items-center">
      {claimed ? null : fallback}
    </div>
  );
}

/**
 * Renders its children into the bar's slot. Nothing at all until the slot exists,
 * which is after the first client render — so what goes here has to be an addition
 * to the page, never the only copy of something it needs to say.
 */
export function TopbarPortal({ children }: { children: ReactNode }) {
  const { element, claim } = useContext(TopbarSlotContext);

  useEffect(claim, [claim]);

  return element === null ? null : createPortal(children, element);
}
