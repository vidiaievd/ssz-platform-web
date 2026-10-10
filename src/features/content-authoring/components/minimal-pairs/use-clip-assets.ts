'use client';

import { useEffect } from 'react';
import { useQueries } from '@tanstack/react-query';

import { allWords, hasClip, setClip as setClipOf } from '@/lib/shared-kernel/minimal-pairs';

import type { ClipAsset, ClipSources } from './clip-sources';
import type { DocumentUpdate, MinimalPairsDocument } from './edits';

/** How often an unmeasured asset is asked again. TTS is ready in about four seconds. */
export const POLL_MS = 1500;

/**
 * Every clip's asset as the media service sees it now: measured or not, and a URL to hear it.
 *
 * An asset that is not `READY` yet is asked again every `POLL_MS`; once it is, its length is
 * written into the word (plan 72 §3.1: the document keeps the server's duration, because the
 * length checks run where there is no media service — the publish preflight). A document opened
 * on another day with a clip still unmeasured picks the length up the same way. The write is an
 * edit of the latest document, so a word typed in between survives it.
 */
export function useClipAssets(
  exercise: MinimalPairsDocument,
  sources: ClipSources,
  onChange: DocumentUpdate,
): Map<string, ClipAsset> {
  const ids = [
    ...new Set(
      allWords(exercise)
        .filter((w) => hasClip(w.clip))
        .map((w) => w.clip.assetId),
    ),
  ];

  const results = useQueries({
    // `sources` is the transport, not a parameter of the answer: one asset, one entry.
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queries: ids.map((id) => ({
      queryKey: ['media', 'assets', id, 'clip'] as const,
      queryFn: () => sources.describe(id),
      refetchInterval: (query: { state: { data?: ClipAsset } }) =>
        query.state.data?.status === 'pending' ? POLL_MS : false,
      // A signed URL lives an hour; asking again within a few minutes is enough.
      staleTime: 5 * 60_000,
    })),
  });

  const assets = new Map<string, ClipAsset>();
  ids.forEach((id, i) => {
    const data = results[i]?.data;
    if (data !== undefined) assets.set(id, data);
  });

  // The measured lengths the document does not have yet, as one stable key.
  const measured = ids
    .map((id) => [id, assets.get(id)] as const)
    .filter(([, a]) => a?.status === 'ready' && a.durationMs > 0)
    .map(([id, a]) => `${id}:${a!.durationMs}`)
    .join(',');

  useEffect(() => {
    if (measured === '') return;
    const lengths = new Map(
      measured.split(',').map((entry) => {
        const [id, ms] = entry.split(':');
        return [id!, Number(ms)] as const;
      }),
    );
    onChange((current) => {
      let next = current;
      for (const w of allWords(current)) {
        const ms = lengths.get(w.clip.assetId);
        if (ms !== undefined && w.clip.durationMs !== ms) {
          next = { ...next, ...setClipOf(next, w.pairId, w.id, { durationMs: ms }) };
        }
      }
      return next;
    });
  }, [measured, onChange]);

  return assets;
}
