import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { vi } from 'vitest';
import { createMockRecorder, type MockRecorder } from '@/features/student/exercises/recorder';

import { enMessages } from '@/lib/i18n/messages';
import {
  emptyContent,
  sampleDocument,
  type MinimalPairsContent,
} from '@/lib/shared-kernel/minimal-pairs';

import type { ClipAsset, ClipSources } from './clip-sources';
import type { DocumentUpdate, MinimalPairsDocument } from './edits';
import type { DecodedAudio } from './slice';

/** A fragment mounted alone has no landmarks; that rule is the page's, not the step's. */
export const PAGE_RULES = {
  rules: { region: { enabled: false }, 'color-contrast': { enabled: false } },
};

export const LOADED_AT = '2026-10-10T10:00:00.000Z';

export function documentOf(content: MinimalPairsContent): MinimalPairsDocument {
  return { ...content, updatedAt: LOADED_AT };
}

/** A fresh exercise in a Bokmål course: one empty pair, the first family chosen. */
export const blankDocument = (): MinimalPairsDocument => documentOf(emptyContent('nb', 'kjsj'));
export const sampleMinimalPairs = (): MinimalPairsDocument => documentOf(sampleDocument());

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
  initial: MinimalPairsDocument;
  step: (props: { exercise: MinimalPairsDocument; onChange: DocumentUpdate }) => ReactNode;
  onChange?: (next: MinimalPairsDocument) => void;
}) {
  const [exercise, setExercise] = useState(initial);
  const report = useRef(onChange);
  useEffect(() => {
    report.current = onChange;
  });
  // Stable, as the builder's `setState` is: a step's effects may depend on it.
  const update = useCallback<DocumentUpdate>((next) => {
    setExercise((current) => {
      const value = typeof next === 'function' ? next(current) : next;
      if (value !== current) report.current?.(value);
      return value;
    });
  }, []);
  return (
    <Intl>
      <Step exercise={exercise} onChange={update} />
    </Intl>
  );
}

/** Asset ids → what media-service says about them, for a fake `describe`. */
export type AssetTable = Record<string, Partial<ClipAsset>>;

export interface FakeSources extends ClipSources {
  mic: MockRecorder;
  /** What `describe` answers from now on, by asset id; unknown ids are pending. */
  assets: AssetTable;
  upload: ReturnType<typeof vi.fn<(file: File, exerciseId: string) => Promise<string>>>;
  synthesize: ReturnType<
    typeof vi.fn<
      (
        text: string,
        language: string,
        exerciseId: string,
      ) => Promise<{ assetId: string; voice: string }>
    >
  >;
  decode: ReturnType<typeof vi.fn<(file: File) => Promise<DecodedAudio>>>;
}

/**
 * Sources with no network and no microphone. Uploads answer `up-<file name>`, synthesis
 * `tts-<text>`; every clip already in `initial` is ready at the length the document says.
 */
export function fakeSources(initial?: MinimalPairsContent): FakeSources {
  const mic = createMockRecorder();
  const assets: AssetTable = {};
  for (const p of initial?.pairs ?? []) {
    for (const w of p.words) {
      if (w.clip.assetId !== '')
        assets[w.clip.assetId] = { status: 'ready', durationMs: w.clip.durationMs };
    }
  }
  return {
    mic,
    assets,
    upload: vi.fn((file: File) => Promise.resolve(`up-${file.name}`)),
    synthesize: vi.fn((text: string) =>
      Promise.resolve({ assetId: `tts-${text}`, voice: 'nb_NO-talesyntese' }),
    ),
    describe: (id) =>
      Promise.resolve({
        status: 'pending',
        durationMs: 0,
        url: `https://minio.test/${id}`,
        ...assets[id],
      }),
    recorder: () => mic,
    decode: vi.fn(() => Promise.reject(new Error('no decoder in this test'))),
  };
}
