'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { dropUndoEntry, pushUndoEntry, type UndoEntry } from '../lib/structure-undo';

export interface StructureUndo {
  /** Records what would put the tree back, and offers it in a toast for five seconds. */
  record: (entry: UndoEntry) => void;
  /** Reverts the most recent edit — what ⌘Z reaches. */
  undo: () => void;
  canUndo: boolean;
}

/**
 * Recording is a no-op outside a provider, so a tree rendered on its own — in a
 * story, in a test of something else — still works. An edit that goes
 * unrecorded is a missing undo, not a broken screen.
 */
const StructureUndoContext = createContext<StructureUndo>({
  record: () => {},
  undo: () => {},
  canUndo: false,
});

export function useStructureUndo(): StructureUndo {
  return useContext(StructureUndoContext);
}

/**
 * Holds the undo stack for one course structure screen.
 *
 * Every edit is already persisted by the time it lands here, so undoing sends
 * the opposite request rather than restoring a snapshot (see `UndoEntry`). Two
 * ways in, and they answer different questions: the toast undoes *the edit it
 * announced*, wherever that has ended up in the stack by the time it is
 * pressed, while ⌘Z undoes the most recent one.
 */
export function StructureUndoProvider({
  onChanged,
  children,
}: {
  /** Reload the tree once an edit has been reverted. */
  onChanged: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations('Authoring.undo');
  const [stack, setStack] = useState<readonly UndoEntry[]>([]);
  // One revert at a time: they are ordinary requests, and two in flight would
  // race over the same positions.
  const running = useRef(false);

  const run = useCallback(
    (entry: UndoEntry) => {
      if (running.current) return;
      running.current = true;
      setStack((prev) => dropUndoEntry(prev, entry));
      void (async () => {
        const reverted = await entry.revert();
        running.current = false;
        if (!reverted) {
          toast.error(t('failed'));
          return;
        }
        toast.success(t('done'));
        onChanged();
      })();
    },
    [onChanged, t],
  );

  const undo = useCallback(() => {
    const latest = stack.at(-1);
    if (!latest) {
      toast(t('nothing'));
      return;
    }
    run(latest);
  }, [run, stack, t]);

  const record = useCallback(
    (entry: UndoEntry) => {
      setStack((prev) => pushUndoEntry(prev, entry));
      toast(entry.label, {
        duration: 5000,
        action: { label: t('action'), onClick: () => run(entry) },
      });
    },
    [run, t],
  );

  // The listener is bound once; it reaches the current `undo` through a ref so
  // that recording an edit does not rebind it.
  const undoRef = useRef(undo);
  useEffect(() => {
    undoRef.current = undo;
  }, [undo]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      // Inside a field ⌘Z belongs to the text being typed, not to the course.
      if (
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      event.preventDefault();
      undoRef.current();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <StructureUndoContext.Provider value={{ record, undo, canUndo: stack.length > 0 }}>
      {children}
    </StructureUndoContext.Provider>
  );
}
