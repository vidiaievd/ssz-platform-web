'use server';

import { revalidatePath } from 'next/cache';

import { serverFetch } from '@/lib/api/server-fetcher';
import { isAppError } from '@/lib/errors';
import { err, ok, tryAction, type Result } from '@/lib/result';
import {
  DEFAULT_SETTINGS,
  PRESETS,
  TEMPLATE_CODE,
  type PersistedAnswers,
  type PersistedContent,
} from '@/lib/shared-kernel/multiple-choice-group';
import type { DifficultyLevel, Visibility } from '@/features/content/types';

import { resolveExerciseTemplateId } from '../lib/exercise-templates';
import { addItemToDraft } from '../lib/container-items';

/** Instructions are authored in the explanation language, as elsewhere in authoring. */
const INSTRUCTION_LANGUAGE = 'en';

/**
 * The ids a brand-new table opens with.
 *
 * Fixed rather than minted: the kernel's factories draw from `Math.random` because they
 * also run in a service, and a scaffold built on a server has no reason to be random —
 * these ids only have to be unique inside their own document, which they are.
 */
const SCAFFOLD_ROW_IDS = ['r1', 'r2', 'r3', 'r4'] as const;
const SCAFFOLD_COLUMN_IDS = ['c1', 'c2'] as const;

export interface SaveMultipleChoiceGroupInput {
  content: PersistedContent;
  expectedAnswers: PersistedAnswers;
  /** The `updatedAt` the builder last saw. The write is refused if the row moved on. */
  expectedUpdatedAt: string;
  instructions: string;
}

export type SaveMultipleChoiceGroupOutcome =
  | { status: 'saved'; updatedAt: string }
  /** Someone else saved first. The builder keeps the teacher's text and offers a reload. */
  | { status: 'conflict'; currentUpdatedAt: string | null };

/**
 * Autosave for the multiple-choice-group builder.
 *
 * The same shape as the eight before it, and for the same reason: the builder owns the
 * whole document, so there is nothing to merge with the generic exercise form, and the
 * write has to be conditional — both columns are replaced wholesale, and two authors
 * saving in turn would otherwise erase each other silently.
 *
 * Both columns go every time, and for this type that is not a precaution but the shape of
 * the document: which column a statement belongs in is **only** in `expectedAnswers`,
 * keyed by row id. A `content` written without it would leave the key pointing at rows
 * that no longer exist, and the table would grade every answer wrong while looking correct
 * on screen.
 */
export async function saveMultipleChoiceGroupAction(
  exerciseId: string,
  containerId: string,
  input: SaveMultipleChoiceGroupInput,
): Promise<Result<SaveMultipleChoiceGroupOutcome>> {
  try {
    const { updatedAt } = await serverFetch<{ updatedAt: string }>({
      service: 'content',
      path: `/exercises/${exerciseId}`,
      method: 'PATCH',
      body: {
        content: input.content,
        expectedAnswers: input.expectedAnswers,
        expectedUpdatedAt: input.expectedUpdatedAt,
      },
    });

    // Separate storage and separate history: the instruction row has no bearing on the
    // exercise's `updatedAt`, so writing it cannot invalidate the token just returned.
    await serverFetch({
      service: 'content',
      path: `/exercises/${exerciseId}/instructions`,
      method: 'POST',
      body: {
        instructionLanguage: INSTRUCTION_LANGUAGE,
        instructionText: input.instructions.trim(),
      },
    });

    revalidatePath(`/school/content/${containerId}`);
    return ok({ status: 'saved', updatedAt });
  } catch (error) {
    if (isAppError(error) && error.code === 'conflict') {
      return ok({ status: 'conflict', currentUpdatedAt: readCurrentUpdatedAt(error.details) });
    }
    if (isAppError(error)) {
      // The upstream's own sentence, when it sent one. `AppError.message` at this point is
      // the BFF's wrapper — "Upstream 422 on content/exercises/<uuid>" — which tells the
      // author which request failed and nothing about why. The service says why, and that
      // is the half worth showing: the difference between a dead end and a thing to fix.
      const upstream = readUpstreamMessage(error.details);
      return err({ ...error.toJSON(), ...(upstream === null ? {} : { message: upstream }) });
    }
    throw error;
  }
}

/** The `message` of the service's error body, if it sent one. */
function readUpstreamMessage(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const value = (details as Record<string, unknown>)['message'];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** `{ message, currentUpdatedAt }` from content-service, defended against any other shape. */
function readCurrentUpdatedAt(details: unknown): string | null {
  if (typeof details !== 'object' || details === null) return null;
  const value = (details as Record<string, unknown>)['currentUpdatedAt'];
  return typeof value === 'string' ? value : null;
}

/**
 * The document a brand-new table starts as: the Riktig/Galt column pair and four empty
 * rows, exactly as README's "Defaults" defines it.
 *
 * Nothing here pretends the table is ready. No statements and no explanations are blockers
 * the gate reports from the first mount, and the rail's badges are how the author is told
 * which screen answers them — except step 2, which says "nothing here yet" instead, because
 * an untouched scaffold is not a mistake (plan 54 §5, deviation 5).
 *
 * The key column is written even though every row's answer is `null`. An absent
 * `expectedAnswers.rows` would be read back as "this table's key was never written", which
 * is true — but the map is what every later save patches, and creating the row without it
 * makes the first save the one that invents the shape. It is also what tells the readers
 * apart: `anyOf: [rows, items]` is how the template's schema distinguishes the new form
 * from the two documents still written the old way.
 *
 * The column labels come from the kernel's first preset and the instruction from the
 * caller. The labels are Norwegian and deliberately so — they are a starting point the
 * author edits, offered by name on step 1 — while a Norwegian *instruction* baked in here
 * would be handed to the Ukrainian school and the English one alike (plan 53 §3.6, carried
 * from plans 51 and 52).
 */
function scaffold(instruction: string): { content: PersistedContent; answers: PersistedAnswers } {
  const preset = PRESETS[0]!;

  return {
    content: {
      title: '',
      instruction,
      source: { mode: 'none', label: '', text: '' },
      columns: preset.columns.map(([label, short], at) => ({
        id: SCAFFOLD_COLUMN_IDS[at] ?? `c${at + 1}`,
        label,
        short,
      })),
      rows: SCAFFOLD_ROW_IDS.map((id) => ({ id, text: '' })),
      settings: { ...DEFAULT_SETTINGS },
    },
    answers: {
      rows: Object.fromEntries(
        SCAFFOLD_ROW_IDS.map((id) => [id, { answer: null, why: '', quote: '' }]),
      ),
    },
  };
}

/**
 * Create a `multiple_choice_group` exercise of the new form and file it in the module's
 * draft.
 *
 * The scaffold is required rather than convenient. The template's content schema accepts a
 * document with `rows` **or** with `items` (plan 54 phase 2), so an exercise created
 * without one would be written in the old `items` shape by the generic form — and the
 * builder, which dispatches on the shape of the document, would never open for it. A
 * document with neither field is refused outright, so a builder mounted on nothing could
 * not save its way out either.
 *
 * The ninth entry in `OWN_BUILDER_SCAFFOLDS`.
 */
export async function createMultipleChoiceGroupAction(
  containerId: string,
  targetLanguage: string,
  difficultyLevel: DifficultyLevel,
  visibility: Visibility,
  instructions: string,
  ownerSchoolId?: string | null,
) {
  return tryAction(async () => {
    const exerciseTemplateId = await resolveExerciseTemplateId(TEMPLATE_CODE);
    const { content, answers } = scaffold(instructions.trim());

    const { exerciseId } = await serverFetch<{ exerciseId: string }>({
      service: 'content',
      path: '/exercises',
      method: 'POST',
      body: {
        exerciseTemplateId,
        targetLanguage,
        difficultyLevel,
        content,
        expectedAnswers: answers,
        visibility,
        ...(ownerSchoolId ? { ownerSchoolId } : {}),
      },
    });

    await serverFetch({
      service: 'content',
      path: `/exercises/${exerciseId}/instructions`,
      method: 'POST',
      body: {
        instructionLanguage: INSTRUCTION_LANGUAGE,
        instructionText: instructions.trim(),
      },
    });

    const item = await addItemToDraft(containerId, 'exercise', exerciseId);
    revalidatePath(`/school/content/${containerId}`);
    return { exerciseId, itemId: item.id };
  });
}
