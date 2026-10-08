// ---------------------------------------------------------------------------
// GENERATED FILE — DO NOT EDIT.
// Source: ssz-platform/packages/shared-kernel/src/minimal-pairs/projection.ts
// Regenerate with `npm run kernel:sync`; verify with `npm run kernel:check`.
// ---------------------------------------------------------------------------

// What a student is allowed to see before the first probe (plan 72 §3.2).
//
// Only what the runner draws before a probe is handed out, and what the reader card says: the
// title, the instruction, the contrast's label, the number of probes, the listening budget and
// the feedback switches. **No pair, no word, no clip and no asset id** — which clip is which
// word is the answer, and probes arrive one at a time from the engine. No pass mark either: it
// comes back with the result (plan 72 §5, row 13).

import type { Feedback } from './model';
import { exerciseContrast } from './packs/index';
import { readContent } from './persistence';

export interface StudentProjection {
  title: string;
  instruction: string;
  language: string;
  /** Seen by the student: «kj / sj», «ç – ʃ». Empty when the pack does not know the family. */
  contrast: { label: string; ipa: string };
  set: { probes: number; playsPerProbe: 0 | 1 | 2 | 3; autoplay: boolean };
  feedback: Feedback;
}

export function toStudentProjection(content: unknown): StudentProjection {
  const c = readContent(content);
  const family = exerciseContrast({ ...c, pairs: [] });
  return {
    title: c.title,
    instruction: c.instruction,
    language: c.language,
    contrast: { label: family?.label ?? '', ipa: family?.ipa ?? '' },
    set: { probes: c.set.probes, playsPerProbe: c.set.playsPerProbe, autoplay: c.set.autoplay },
    feedback: { ...c.feedback },
  };
}
