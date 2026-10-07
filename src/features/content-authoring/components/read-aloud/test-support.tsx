import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';

import { enMessages } from '@/lib/i18n/messages';
import { readAudioDraft } from '@/lib/shared-kernel/audio';
import {
  emptyContent,
  sampleDocument,
  type ReadAloudContent,
} from '@/lib/shared-kernel/read-aloud';

import type { ReadAloudDocument } from './edits';

/** A fragment mounted alone has no landmarks; that rule is the page's, not the step's. */
export const PAGE_RULES = {
  rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
};

export const LOADED_AT = '2026-10-07T10:00:00.000Z';

export function documentOf(content: ReadAloudContent = emptyContent('nb')): ReadAloudDocument {
  return { ...content, updatedAt: LOADED_AT, audio: readAudioDraft({}, 'read_aloud') };
}

export const blankDocument = (): ReadAloudDocument => documentOf(emptyContent('nb'));
export const sampleReadAloud = (): ReadAloudDocument => documentOf(sampleDocument());

export function Intl({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="en" messages={enMessages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

/** A step under test, holding the document the way the builder does. */
export function Harness({
  initial,
  step: Step,
  onChange,
}: {
  initial: ReadAloudDocument;
  step: (props: {
    exercise: ReadAloudDocument;
    onChange: (next: ReadAloudDocument) => void;
  }) => ReactNode;
  onChange?: (next: ReadAloudDocument) => void;
}) {
  const [exercise, setExercise] = useState(initial);
  return (
    <Intl>
      <Step
        exercise={exercise}
        onChange={(next) => {
          onChange?.(next);
          setExercise(next);
        }}
      />
    </Intl>
  );
}
