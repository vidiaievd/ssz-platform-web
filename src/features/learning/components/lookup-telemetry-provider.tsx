'use client';

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';

import type { GlossaryLevel } from './glossary-popover';

/** Records that a reader opened a word card. Fire-and-forget. */
export type LookupReporter = (vocabularyItemId: string, level: GlossaryLevel) => void;

const NO_OP: LookupReporter = () => {};

const LookupTelemetryContext = createContext<LookupReporter>(NO_OP);

/** One buffered lookup, as sent to the BFF. `srsState` is resolved server-side (spec 18 §5.1). */
export interface LookupRecord {
  lessonId: string;
  lessonVariantId: string;
  vocabularyItemId: string;
  level: GlossaryLevel;
  /** When the reader opened the card, not when the batch was flushed. */
  occurredAt: string;
}

/** Batch window. Long enough to collect a paragraph's worth of lookups, short enough to lose little. */
const FLUSH_INTERVAL_MS = 10_000;

export interface LookupTelemetryProviderProps {
  lessonId: string;
  lessonVariantId: string;
  children: ReactNode;
}

/**
 * Collects word-card openings and ships them in batches (spec 18 §6).
 *
 * A context rather than props for the same reason as `GlossIntensityProvider`:
 * the markdown renderer sits between the page that knows the lesson and the
 * words that are opened. Surfaces with no provider — the vocabulary card,
 * authoring previews, Storybook — report nothing and need no configuration.
 *
 * Deliberately lossy: no retry, no persistence across reloads, every failure
 * swallowed. Telemetry that can interrupt a reading session is worse than
 * telemetry that drops a batch.
 */
export function LookupTelemetryProvider({
  lessonId,
  lessonVariantId,
  children,
}: LookupTelemetryProviderProps) {
  const buffer = useRef<LookupRecord[]>([]);
  // A word hovered four times while parsing a sentence is one act of not
  // knowing it; the promotion from preview to full is a separate signal.
  const seen = useRef(new Set<string>());

  const flush = useCallback(() => {
    const lookups = buffer.current;
    if (lookups.length === 0) return;
    buffer.current = [];
    void sendLookups(lookups);
  }, []);

  const report = useCallback<LookupReporter>(
    (vocabularyItemId, level) => {
      const key = `${vocabularyItemId}:${level}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      buffer.current.push({
        lessonId,
        lessonVariantId,
        vocabularyItemId,
        level,
        occurredAt: new Date().toISOString(),
      });
    },
    [lessonId, lessonVariantId],
  );

  useEffect(() => {
    const timer = setInterval(flush, FLUSH_INTERVAL_MS);
    // The reader closing the tab is the common case for the last words of a
    // text; `visibilitychange` is the only unload signal browsers still honour.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHidden);
      flush();
    };
  }, [flush]);

  return <LookupTelemetryContext value={report}>{children}</LookupTelemetryContext>;
}

export function useLookupReporter(): LookupReporter {
  return useContext(LookupTelemetryContext);
}

async function sendLookups(lookups: LookupRecord[]): Promise<void> {
  try {
    await fetch('/api/learning/lookups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lookups }),
      keepalive: true,
    });
  } catch {
    // Intentionally silent — see the component doc comment.
  }
}
