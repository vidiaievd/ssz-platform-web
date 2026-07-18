import type { ExerciseInstruction } from '@/features/content/types';

import { EXERCISE_TYPES, type ExerciseFormValues, type ExerciseType } from '../schemas/exercise';

const EXERCISE_TYPES_SET = new Set<string>(EXERCISE_TYPES);

/**
 * Maps the exercise form model to/from the content-service exercise contract.
 *
 * The backend stores `content` and `expectedAnswers` as separate JSONB objects,
 * each validated against the template's `contentSchema` / `answerSchema`
 * (content-service prisma/seed.ts). All schema keys are snake_case. These pure
 * functions are the single place that knows those shapes.
 */

export const DEFAULT_EXERCISE_VALUES: ExerciseFormValues = {
  templateCode: 'multiple_choice',
  instructions: '',
  hint: '',
  difficultyLevel: undefined,
  mcQuestion: '',
  mcContext: '',
  mcOptions: [{ text: '' }, { text: '' }],
  mcCorrectIndex: 0,
  fibText: '',
  fibBlanks: [{ answers: '' }],
  fibWordBank: '',
  trSourceText: '',
  trSourceLanguage: '',
  trAcceptedTranslations: [{ text: '' }],
  mpPairs: [
    { left: '', right: '' },
    { left: '', right: '' },
  ],
  saQuestion: '',
  saContext: '',
  saReferenceAnswer: '',
  saAccepted: '',
  wtPrompt: '',
  wtMinWords: '',
  wtTopics: [],
  wtRubric: '',
};

/** A minimal, valid multiple-choice draft — used to seed picker/starter exercises. */
export function minimalMcqValues(question: string): ExerciseFormValues {
  return {
    ...DEFAULT_EXERCISE_VALUES,
    templateCode: 'multiple_choice',
    mcQuestion: question,
    mcOptions: [{ text: 'Option 1' }, { text: 'Option 2' }],
    mcCorrectIndex: 0,
  };
}

const splitCsv = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export interface ExercisePayload {
  content: Record<string, unknown>;
  expectedAnswers: Record<string, unknown>;
}

/** Form model → `{ content, expectedAnswers }` conforming to the template schemas. */
export function buildExercisePayload(values: ExerciseFormValues): ExercisePayload {
  switch (values.templateCode) {
    case 'multiple_choice': {
      const options = (values.mcOptions ?? [])
        .filter((o) => o.text.trim())
        .map((o, i) => ({ id: `opt-${i}`, text: o.text.trim() }));
      const correctIndex = Math.min(values.mcCorrectIndex ?? 0, Math.max(options.length - 1, 0));
      return {
        content: {
          question: values.mcQuestion?.trim() ?? '',
          options,
          ...(values.mcContext?.trim() && { context: values.mcContext.trim() }),
        },
        expectedAnswers: {
          correct_option_ids: options[correctIndex] ? [options[correctIndex].id] : [],
        },
      };
    }
    case 'fill_in_blank': {
      const blanks = (values.fibBlanks ?? [])
        .map((b, i) => ({ blank_id: i + 1, accepted_answers: splitCsv(b.answers) }))
        .filter((b) => b.accepted_answers.length > 0);
      const wordBank = splitCsv(values.fibWordBank);
      return {
        content: {
          text_with_blanks: values.fibText?.trim() ?? '',
          ...(wordBank.length > 0 && { word_bank: wordBank }),
        },
        expectedAnswers: { blanks },
      };
    }
    case 'translate_to_target':
    case 'translate_from_target': {
      const translations = (values.trAcceptedTranslations ?? [])
        .map((t) => t.text.trim())
        .filter(Boolean);
      return {
        content: {
          source_text: values.trSourceText?.trim() ?? '',
          ...(values.templateCode === 'translate_to_target' &&
            values.trSourceLanguage?.trim() && { source_language: values.trSourceLanguage.trim() }),
        },
        expectedAnswers: { accepted_translations: translations },
      };
    }
    case 'match_pairs': {
      const pairs = (values.mpPairs ?? []).filter((p) => p.left.trim() && p.right.trim());
      const leftItems = pairs.map((p, i) => ({ id: `l-${i}`, text: p.left.trim() }));
      const rightItems = pairs.map((p, i) => ({ id: `r-${i}`, text: p.right.trim() }));
      return {
        content: { left_items: leftItems, right_items: rightItems },
        expectedAnswers: {
          pairs: pairs.map((_, i) => ({ left_id: `l-${i}`, right_id: `r-${i}` })),
        },
      };
    }
    case 'short_answer': {
      const accepted = splitCsv(values.saAccepted);
      return {
        content: {
          question: values.saQuestion?.trim() ?? '',
          ...(values.saContext?.trim() && { context: values.saContext.trim() }),
        },
        expectedAnswers: {
          reference_answer: values.saReferenceAnswer?.trim() ?? '',
          ...(accepted.length > 0 && { accepted_answers: accepted }),
        },
      };
    }
    case 'writing_task': {
      const topics = (values.wtTopics ?? [])
        .filter((tp) => tp.title.trim())
        .map((tp, i) => ({ id: `topic-${i}`, title: tp.title.trim() }));
      const minWords = Number.parseInt(values.wtMinWords ?? '', 10);
      return {
        content: {
          prompt: values.wtPrompt?.trim() ?? '',
          ...(topics.length > 0 && { options: topics }),
          ...(Number.isFinite(minWords) && minWords > 0 && { min_words: minWords }),
        },
        expectedAnswers: {
          ...(values.wtRubric?.trim() && { rubric: values.wtRubric.trim() }),
        },
      };
    }
  }
}

interface McqOption {
  id?: unknown;
  text?: unknown;
}

/** `{ templateCode, content, expectedAnswers, instructions }` (backend shape) → form model. */
export function parseExerciseToForm(exercise: {
  templateCode: string;
  content: Record<string, unknown>;
  expectedAnswers?: Record<string, unknown>;
  instructions?: ExerciseInstruction[] | null;
}): ExerciseFormValues {
  const { templateCode, content, expectedAnswers = {}, instructions } = exercise;
  const known = (EXERCISE_TYPES_SET.has(templateCode) ? templateCode : 'multiple_choice') as ExerciseType;
  // Instructions are a per-language sub-resource; the editor edits the first entry.
  const primary = instructions?.[0];
  const base: ExerciseFormValues = {
    ...DEFAULT_EXERCISE_VALUES,
    templateCode: known,
    instructions: primary?.instructionText ?? '',
    hint: primary?.hintText ?? '',
  };

  switch (known) {
    case 'multiple_choice': {
      const rawOptions = Array.isArray(content.options) ? (content.options as McqOption[]) : [];
      const options = rawOptions.map((o) => ({
        id: typeof o.id === 'string' ? o.id : '',
        text: typeof o.text === 'string' ? o.text : '',
      }));
      const correctIds = Array.isArray(expectedAnswers.correct_option_ids)
        ? (expectedAnswers.correct_option_ids as unknown[]).map(String)
        : [];
      const correctIndex = Math.max(
        options.findIndex((o) => correctIds.includes(o.id)),
        0,
      );
      return {
        ...base,
        mcQuestion: typeof content.question === 'string' ? content.question : '',
        mcContext: typeof content.context === 'string' ? content.context : '',
        mcOptions:
          options.length >= 2 ? options.map((o) => ({ text: o.text })) : [{ text: '' }, { text: '' }],
        mcCorrectIndex: correctIndex,
      };
    }
    case 'fill_in_blank': {
      const rawBlanks = Array.isArray(expectedAnswers.blanks)
        ? (expectedAnswers.blanks as Array<{ blank_id?: unknown; accepted_answers?: unknown }>)
        : [];
      const blanks = rawBlanks
        .slice()
        .sort((a, b) => Number(a.blank_id ?? 0) - Number(b.blank_id ?? 0))
        .map((b) => ({
          answers: Array.isArray(b.accepted_answers)
            ? (b.accepted_answers as unknown[]).map(String).join(', ')
            : '',
        }));
      const wordBank = Array.isArray(content.word_bank)
        ? (content.word_bank as unknown[]).map(String).join(', ')
        : '';
      return {
        ...base,
        fibText: typeof content.text_with_blanks === 'string' ? content.text_with_blanks : '',
        fibBlanks: blanks.length > 0 ? blanks : [{ answers: '' }],
        fibWordBank: wordBank,
      };
    }
    case 'translate_to_target':
    case 'translate_from_target': {
      const translations = Array.isArray(expectedAnswers.accepted_translations)
        ? (expectedAnswers.accepted_translations as unknown[]).map((t) => ({ text: String(t) }))
        : [];
      return {
        ...base,
        trSourceText: typeof content.source_text === 'string' ? content.source_text : '',
        trSourceLanguage: typeof content.source_language === 'string' ? content.source_language : '',
        trAcceptedTranslations: translations.length > 0 ? translations : [{ text: '' }],
      };
    }
    case 'match_pairs': {
      const leftItems = Array.isArray(content.left_items)
        ? (content.left_items as McqOption[])
        : [];
      const rightItems = Array.isArray(content.right_items)
        ? (content.right_items as McqOption[])
        : [];
      const rightById = new Map(
        rightItems.map((r) => [String(r.id), typeof r.text === 'string' ? r.text : '']),
      );
      const answerPairs = Array.isArray(expectedAnswers.pairs)
        ? (expectedAnswers.pairs as Array<{ left_id?: unknown; right_id?: unknown }>)
        : [];
      const rightByLeftId = new Map(answerPairs.map((p) => [String(p.left_id), String(p.right_id)]));
      const pairs = leftItems.map((l) => {
        const rightId = rightByLeftId.get(String(l.id));
        return {
          left: typeof l.text === 'string' ? l.text : '',
          right: rightId ? (rightById.get(rightId) ?? '') : '',
        };
      });
      return {
        ...base,
        mpPairs:
          pairs.length >= 2
            ? pairs
            : [
                { left: '', right: '' },
                { left: '', right: '' },
              ],
      };
    }
    case 'short_answer': {
      const accepted = Array.isArray(expectedAnswers.accepted_answers)
        ? (expectedAnswers.accepted_answers as unknown[]).map(String).join(', ')
        : '';
      return {
        ...base,
        saQuestion: typeof content.question === 'string' ? content.question : '',
        saContext: typeof content.context === 'string' ? content.context : '',
        saReferenceAnswer:
          typeof expectedAnswers.reference_answer === 'string' ? expectedAnswers.reference_answer : '',
        saAccepted: accepted,
      };
    }
    case 'writing_task': {
      const topics = Array.isArray(content.options)
        ? (content.options as Array<{ title?: unknown }>).map((o) => ({
            title: typeof o.title === 'string' ? o.title : '',
          }))
        : [];
      return {
        ...base,
        wtPrompt: typeof content.prompt === 'string' ? content.prompt : '',
        wtMinWords: typeof content.min_words === 'number' ? String(content.min_words) : '',
        wtTopics: topics,
        wtRubric: typeof expectedAnswers.rubric === 'string' ? expectedAnswers.rubric : '',
      };
    }
  }
}
