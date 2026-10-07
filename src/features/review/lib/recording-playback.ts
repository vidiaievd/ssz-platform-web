import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';
import { readSubmission } from '@/lib/shared-kernel/read-aloud';

import type { ReviewPlayback } from '../types';

/** media-service's answer to `POST /internal/media/assets/playback`. */
interface MediaPlayback extends ReviewPlayback {
  id: string;
}

/**
 * The assets a `read_aloud` submission names — the take handed in for each prompt.
 *
 * Read off the submitted answer, not off the breakdown: the breakdown is recomputed against the
 * exercise and is null once the author has deleted it, while the recordings are the student's
 * work and must stay playable (criterion 21). Discarded takes are not asked for: no screen shows
 * them yet (README «Not designed»).
 */
export function recordingIdsOf(submittedAnswer: unknown): string[] {
  const submission = readSubmission(submittedAnswer);
  if (submission === null) return [];
  return [...new Set(submission.recordings.map((recording) => recording.assetId))];
}

/**
 * Signed links to a submission's recordings, for the reviewer who has just been authorised to
 * read it (plan 70 Q2, RA-Q8).
 *
 * The caller's authorisation is the whole guard: media-service signs whatever it is handed, so
 * this must only ever be called after `authorizeSubmission`, with ids taken from the engine's
 * copy of the submission. Null when media-service did not answer — the screen says so and the
 * submission stays readable; a 500 here would block the learner waiting behind it.
 */
export async function fetchRecordingPlayback(
  assetIds: readonly string[],
): Promise<Record<string, ReviewPlayback> | null> {
  if (assetIds.length === 0) return {};

  try {
    const answer = await serverFetch<MediaPlayback[]>({
      service: 'media',
      path: '/internal/media/assets/playback',
      method: 'POST',
      directBaseUrl: env.MEDIA_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
      body: { ids: assetIds },
    });

    const out: Record<string, ReviewPlayback> = {};
    for (const { id, ...playback } of answer) out[id] = playback;
    return out;
  } catch {
    return null;
  }
}
