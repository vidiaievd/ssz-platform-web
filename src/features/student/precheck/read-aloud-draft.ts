import {
  chosenIndex,
  takesOf,
  type RecorderConfig,
  type RecorderState,
  type Submission,
  type SubmittedRecording,
} from '@/lib/shared-kernel/read-aloud';

/**
 * What a rehearsal of `read_aloud` sends (platform plan 84): the chosen take of every prompt
 * that has one uploaded, in prompt order. Unlike the hand-in it does not need them all — a
 * reading may be rehearsed a passage at a time. Null when nothing is uploaded yet.
 *
 * Here and not in the shared kernel, which is generated from the monorepo: the hand-in's
 * `toSubmission` stays the one rule for what is finally sent.
 */
export function toRehearsalDraft(state: RecorderState, config: RecorderConfig): Submission | null {
  const recordings: SubmittedRecording[] = [];
  for (const p of config.prompts) {
    const own = takesOf(state, p.id);
    const chosen = own[chosenIndex(state, config, p.id)];
    if (!chosen || chosen.assetId === null) continue;
    recordings.push({
      itemId: p.id,
      assetId: chosen.assetId,
      seconds: chosen.seconds,
      takes: own.length,
    });
  }
  return recordings.length === 0 ? null : { recordings };
}
