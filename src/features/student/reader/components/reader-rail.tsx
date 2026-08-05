'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { useMediaQuery } from '@/hooks';

/**
 * Tailwind's `xl`. Below it the reader is a single column: at 1280px the shell
 * is already spending ~370px on the contents sidebar, and a second 320px column
 * would squeeze the prose under a comfortable measure.
 */
export const RAIL_QUERY = '(min-width: 1280px)';

interface ReaderRailContextValue {
  container: HTMLElement | null;
  visible: boolean;
  claim: () => () => void;
}

const ReaderRailContext = createContext<ReaderRailContextValue | null>(null);

/**
 * Wiring for the shell, which owns the rail element itself.
 *
 * `occupied` is deliberately not "is the viewport wide enough": the column is
 * only given width once a page has actually put something in it, so lesson
 * kinds with nothing to show there (an exercise, a live lesson) keep the full
 * width for their content instead of staring at 320px of empty border.
 */
export function useReaderRailHost() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [claims, setClaims] = useState(0);
  const visible = useMediaQuery(RAIL_QUERY);

  const claim = useCallback(() => {
    setClaims((n) => n + 1);
    return () => setClaims((n) => n - 1);
  }, []);

  const value = useMemo<ReaderRailContextValue>(
    () => ({ container, visible, claim }),
    [container, visible, claim],
  );

  return { value, setContainer, occupied: visible && claims > 0 };
}

export function ReaderRailProvider({
  value,
  children,
}: {
  value: ReaderRailContextValue;
  children: ReactNode;
}) {
  return <ReaderRailContext.Provider value={value}>{children}</ReaderRailContext.Provider>;
}

/**
 * Whether the rail is on screen. A page that offers rail content must ask this
 * and render the same thing inline when the answer is false — the slot renders
 * nothing on a narrow viewport, and silently dropping the audio player there
 * would be worse than not having a rail at all.
 */
export function useReaderRailVisible() {
  return useContext(ReaderRailContext)?.visible ?? false;
}

/**
 * Portals its children into the rail. Claims the column on mount even when the
 * viewport is too narrow to show it, so the shell's decision to give the rail
 * width tracks what the page offers rather than what happens to be painted.
 */
export function ReaderRailSlot({ children }: { children: ReactNode }) {
  const ctx = useContext(ReaderRailContext);
  const claim = ctx?.claim;

  useEffect(() => claim?.(), [claim]);

  if (!ctx?.visible || !ctx.container) return null;
  return createPortal(children, ctx.container);
}
