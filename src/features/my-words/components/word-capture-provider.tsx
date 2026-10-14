'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { WordCaptureSource } from '../types';
import { AddWordDialog } from './add-word-dialog';

interface WordCaptureRequest {
  surfaceForm: string;
  contextSentence: string | null;
  paragraphIndex: number | null;
}

interface WordCaptureContextValue {
  open: (request: WordCaptureRequest) => void;
}

const WordCaptureContext = createContext<WordCaptureContextValue | null>(null);

/**
 * What a reader needs to let words go to «My words» (plan 75): the text's language and
 * the variant shown, which is what lets the word join its unit's deck. Without a provider
 * the «add» affordances render nothing, so the same components serve the authoring preview.
 */
export function WordCaptureProvider({
  targetLanguage,
  variantId,
  children,
}: {
  targetLanguage: string;
  variantId: string | null;
  children: ReactNode;
}) {
  const [pending, setPending] = useState<{ surfaceForm: string; source: WordCaptureSource } | null>(
    null,
  );

  const open = useCallback(
    (request: WordCaptureRequest) =>
      setPending({
        surfaceForm: request.surfaceForm,
        source: {
          targetLanguage,
          variantId,
          paragraphIndex: request.paragraphIndex,
          // Offsets into the rendered text are not the markdown offsets the field means.
          charStart: null,
          contextSentence: request.contextSentence,
        },
      }),
    [targetLanguage, variantId],
  );

  const value = useMemo(() => ({ open }), [open]);

  return (
    <WordCaptureContext.Provider value={value}>
      {children}
      {pending && (
        <AddWordDialog
          key={`${pending.surfaceForm}:${pending.source.contextSentence ?? ''}`}
          surfaceForm={pending.surfaceForm}
          source={pending.source}
          onClose={() => setPending(null)}
        />
      )}
    </WordCaptureContext.Provider>
  );
}

/** Null outside a reader that lets words be captured. */
export function useWordCapture(): WordCaptureContextValue | null {
  return useContext(WordCaptureContext);
}
