import {
  fromPersisted as errorCorrectionFromPersisted,
  TEMPLATE_CODE as ERROR_CORRECTION_TEMPLATE_CODE,
} from '@/lib/shared-kernel/error-correction';
import {
  fromPersisted as translateFromPersisted,
  isTranslateCode,
  type TranslateType,
} from '@/lib/shared-kernel/translate';

import type { AuthoredItem } from '../components/review/submission-card';

/** The envelope is the exercise row's business; reading the sentences needs none of it. */
const NO_ENVELOPE = { id: '', moduleId: '', title: '', instructions: '', updatedAt: '' };

/** What a marking queue needs of an exercise: enough to know what it asked for. */
export interface AuthoredExercise {
  id: string;
  templateCode: string;
  content: unknown;
  expectedAnswers: unknown;
}

/**
 * The sentences as their author wrote them, by item id.
 *
 * A queue carries what the learner wrote and how it was judged, never the document it was
 * judged against. Each template is read by its own kernel and reduced to the two fields
 * the card shows, so the card learns neither document — which is what lets one card mark
 * translate and error correction alike.
 *
 * A template nobody has taught this function yet yields an empty map rather than an error:
 * the submission is still markable, just without the prompt beside it.
 */
export function readAuthoredItems(
  exercise: AuthoredExercise | null | undefined,
): Map<string, AuthoredItem> {
  const itemsById = new Map<string, AuthoredItem>();
  if (!exercise) return itemsById;

  if (isTranslateCode(exercise.templateCode)) {
    const document = translateFromPersisted(
      { ...NO_ENVELOPE, id: exercise.id },
      exercise.templateCode as TranslateType,
      exercise.content,
      exercise.expectedAnswers,
    );
    for (const item of document.items) {
      itemsById.set(item.id, { prompt: item.source, teacherNote: item.teacherNote });
    }
  } else if (exercise.templateCode === ERROR_CORRECTION_TEMPLATE_CODE) {
    const document = errorCorrectionFromPersisted(
      { ...NO_ENVELOPE, id: exercise.id },
      exercise.content,
      exercise.expectedAnswers,
    );
    // The faulty sentence, not the key: it is what the learner was looking at, and the
    // key is already in front of the teacher mistake by mistake.
    for (const item of document.items) {
      itemsById.set(item.id, { prompt: item.wrong, teacherNote: item.teacherNote });
    }
  }

  return itemsById;
}
