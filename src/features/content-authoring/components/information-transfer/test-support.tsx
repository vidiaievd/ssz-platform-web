import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';

import { enMessages } from '@/lib/i18n/messages';
import {
  emptyContent,
  sampleContent,
  type InformationTransferContent,
} from '@/lib/shared-kernel/information-transfer';

import type { InformationTransferDocument } from './edits';

/** A fragment mounted alone has no landmarks; that rule is the page's, not the step's. */
export const PAGE_RULES = {
  rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
};

export const LOADED_AT = '2026-10-10T10:00:00.000Z';

export function documentOf(content: InformationTransferContent): InformationTransferDocument {
  return { ...content, updatedAt: LOADED_AT };
}

/** A fresh exercise in a Bokmål course: a text source and one empty field. */
export const blankDocument = (): InformationTransferDocument => documentOf(emptyContent('nb'));

/** The answering machine of Tøyen library, six cells, as a recording or as a notice. */
export const sampleDocument = (
  sourceKind: 'audio' | 'text' = 'text',
): InformationTransferDocument => documentOf(sampleContent(sourceKind));

export function Intl({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
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
  initial: InformationTransferDocument;
  step: (props: {
    exercise: InformationTransferDocument;
    onChange: (next: InformationTransferDocument) => void;
  }) => ReactNode;
  onChange?: (next: InformationTransferDocument) => void;
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
