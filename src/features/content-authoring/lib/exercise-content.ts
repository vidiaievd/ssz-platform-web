import type { ExerciseInstruction } from '@/features/content/types';

import {
  EXERCISE_TYPES,
  RATIONALE_VERDICTS,
  splitChunks,
  type ExerciseFormValues,
  type ExerciseType,
  type RationaleVerdict,
} from '../schemas/exercise';

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
  mcgContext: '',
  mcgSharedOptions: [{ text: '' }, { text: '' }],
  mcgItems: [{ question: '', options: [], correctIndex: 0, explanation: '' }],
  fibText: '',
  fibBlanks: [{ answers: '', rationaleExplanation: '', rationaleOptions: [] }],
  fibWordBank: '',
  trSourceText: '',
  trSourceLanguage: '',
  trAcceptedTranslations: [{ text: '' }],
  mpVariant: 'pairs',
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
  ssSentence: '',
  ssSourceSentence: '',
  ssSchemaType: 'main',
  ssFields: [{ label: '' }, { label: '' }],
  ssTokens: [
    { text: '', fieldIndex: 0 },
    { text: '', fieldIndex: 0 },
  ],
  wbfWordBank: '',
  wbfSentences: [{ text: '', answers: [''], rationales: [] }],
  wbfWordNotes: [],
  ecSentences: [{ chunks: '', fixes: [{ chunkIndex: '', accepted: '', note: '' }] }],
  toKind: 'dialogue',
  toLines: [
    { text: '', speaker: '' },
    { text: '', speaker: '' },
  ],
};

/**
 * A minimal draft for each template, valid enough to be created and then filled in.
 *
 * The picker creates an exercise before the author has written anything, and
 * both `exerciseFormSchema` and the backend's `contentSchema` reject an empty
 * one — so every template needs a structurally complete starting point. The
 * placeholder wording is deliberately untranslated: it is course content in the
 * target language, and the author overwrites it in the editor that opens next.
 */
export function minimalExerciseValues(
  templateCode: ExerciseType,
  prompt: string,
  instructions: string,
): ExerciseFormValues {
  // Not optional: an exercise with no instruction row is a publish blocker
  // (`EXERCISE_INCOMPLETE`), and this path creates the exercise without ever
  // showing the form — so the scaffold has to carry one.
  const base = { ...DEFAULT_EXERCISE_VALUES, templateCode, instructions };

  switch (templateCode) {
    case 'multiple_choice':
      return {
        ...base,
        mcQuestion: prompt,
        mcOptions: [{ text: 'Option 1' }, { text: 'Option 2' }],
        mcCorrectIndex: 0,
      };
    case 'multiple_choice_group':
      return {
        ...base,
        mcgSharedOptions: [{ text: 'Option 1' }, { text: 'Option 2' }],
        mcgItems: [{ question: prompt, options: [], correctIndex: 0, explanation: '' }],
      };
    case 'fill_in_blank':
      return {
        ...base,
        fibText: 'Write a sentence with a ___1___ in it.',
        fibBlanks: [{ answers: 'blank', rationaleExplanation: '', rationaleOptions: [] }],
      };
    case 'translate_to_target':
    case 'translate_from_target':
      return {
        ...base,
        trSourceText: prompt,
        trAcceptedTranslations: [{ text: 'Translation' }],
      };
    case 'match_pairs':
      return {
        ...base,
        mpPairs: [
          { left: 'Left 1', right: 'Right 1' },
          { left: 'Left 2', right: 'Right 2' },
        ],
      };
    case 'short_answer':
      return { ...base, saQuestion: prompt, saReferenceAnswer: 'Reference answer' };
    case 'writing_task':
      return { ...base, wtPrompt: prompt };
    case 'sentence_schema':
      return {
        ...base,
        ssSentence: 'Jeg leser boka.',
        ssFields: [{ label: 'Field 1' }, { label: 'Field 2' }],
        ssTokens: [
          { text: 'Jeg', fieldIndex: 0 },
          { text: 'leser', fieldIndex: 1 },
        ],
      };
    case 'word_bank_fill':
      return {
        ...base,
        wbfWordBank: 'first, second',
        wbfSentences: [{ text: 'Write a sentence with a ___1___ in it.', answers: ['first'] }],
      };
    case 'text_order':
      return {
        ...base,
        toLines: [
          { text: 'First line', speaker: '' },
          { text: 'Second line', speaker: '' },
        ],
      };
    case 'error_correction':
      return {
        ...base,
        ecSentences: [
          {
            chunks: 'First part | second part',
            fixes: [{ chunkIndex: '2', accepted: 'corrected part', note: '' }],
          },
        ],
      };
  }
}

/** A minimal, valid multiple-choice draft — used to seed starter exercises. */
export function minimalMcqValues(question: string, instructions: string): ExerciseFormValues {
  return minimalExerciseValues('multiple_choice', question, instructions);
}

/** Blank ids in reading order, e.g. "a ___1___ b ___3___" → [1, 3]. */
const blankIds = (text: string): number[] =>
  [...text.matchAll(/___(\d+)___/g)].map((m) => Number(m[1]));

interface RationaleValues {
  explanation?: string;
  options?: Array<{ text: string; verdict: RationaleVerdict; note?: string }>;
}

/**
 * The post-check teaching aid, shared by `fill_in_blank` and `word_bank_fill` —
 * both answer schemas define the same `rationale` object. Returns `undefined`
 * for an empty one so the key is dropped rather than stored as `{}`.
 */
function buildRationale(values: RationaleValues) {
  // Only options with a text carry meaning; a half-filled row is dropped rather
  // than persisted as an empty matrix entry.
  const options = (values.options ?? [])
    .filter((o) => o.text.trim())
    .map((o) => ({
      text: o.text.trim(),
      verdict: o.verdict,
      note: o.note?.trim() || undefined,
    }));
  const explanation = values.explanation?.trim();
  if (!explanation && options.length === 0) return undefined;
  return {
    explanation: explanation || undefined,
    options: options.length > 0 ? options : undefined,
  };
}

/** Stored `rationale` → the form's editable shape. */
function parseRationale(value: unknown): RationaleValues {
  const rationale = isPlainObject(value) ? value : {};
  const rawOptions = Array.isArray(rationale.options) ? rationale.options : [];
  return {
    explanation: typeof rationale.explanation === 'string' ? rationale.explanation : '',
    options: (rawOptions as unknown[]).filter(isPlainObject).map((o) => ({
      text: typeof o.text === 'string' ? o.text : '',
      verdict: (RATIONALE_VERDICTS as readonly string[]).includes(String(o.verdict))
        ? (o.verdict as RationaleVerdict)
        : ('wrong' as RationaleVerdict),
      note: typeof o.note === 'string' ? o.note : '',
    })),
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

/**
 * Form model → `{ content, expectedAnswers }` conforming to the template schemas.
 *
 * Every key the form owns is always present, even when the author left it
 * empty — an explicit `undefined` is how this function says "the form models
 * this key and it should not be there", which is what lets the merge below tell
 * a cleared field apart from a field the form never knew about.
 */
function rawExercisePayload(values: ExerciseFormValues): ExercisePayload {
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
          context: values.mcContext?.trim() || undefined,
        },
        expectedAnswers: {
          correct_option_ids: options[correctIndex] ? [options[correctIndex].id] : [],
        },
      };
    }
    case 'multiple_choice_group': {
      // Option ids are scoped to the question they belong to — the engine
      // resolves `correct_option_ids` inside one `items[]` entry — so the shared
      // column and a question's own options can both start at `opt-0`.
      const toOptions = (options: Array<{ text: string }> | undefined) =>
        (options ?? [])
          .filter((o) => o.text.trim())
          .map((o, i) => ({ id: `opt-${i}`, text: o.text.trim() }));

      const shared = toOptions(values.mcgSharedOptions);
      const rows = (values.mcgItems ?? [])
        .filter((it) => it.question.trim())
        .map((it, i) => {
          const own = toOptions(it.options);
          return { row: it, id: `${i + 1}`, own, resolved: own.length > 0 ? own : shared };
        });

      return {
        content: {
          options: shared.length > 0 ? shared : undefined,
          items: rows.map(({ row, id, own }) => ({
            id,
            question: row.question.trim(),
            options: own.length > 0 ? own : undefined,
          })),
          context: values.mcgContext?.trim() || undefined,
        },
        expectedAnswers: {
          items: rows.map(({ row, id, resolved }) => {
            const correct = resolved[row.correctIndex];
            return {
              id,
              correct_option_ids: correct ? [correct.id] : [],
              explanation: row.explanation?.trim() || undefined,
            };
          }),
        },
      };
    }
    case 'fill_in_blank': {
      const blanks = (values.fibBlanks ?? [])
        .map((b, i) => ({
          blank_id: i + 1,
          accepted_answers: splitCsv(b.answers),
          rationale: buildRationale({
            explanation: b.rationaleExplanation,
            options: b.rationaleOptions,
          }),
        }))
        .filter((b) => b.accepted_answers.length > 0);
      const wordBank = splitCsv(values.fibWordBank);
      return {
        content: {
          text_with_blanks: values.fibText?.trim() ?? '',
          word_bank: wordBank.length > 0 ? wordBank : undefined,
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
          source_language:
            values.templateCode === 'translate_to_target'
              ? values.trSourceLanguage?.trim() || undefined
              : undefined,
        },
        expectedAnswers: { accepted_translations: translations },
      };
    }
    case 'match_pairs': {
      const pairs = (values.mpPairs ?? []).filter((p) => p.left.trim() && p.right.trim());
      const leftItems = pairs.map((p, i) => ({ id: `l-${i}`, text: p.left.trim() }));
      const rightItems = pairs.map((p, i) => ({ id: `r-${i}`, text: p.right.trim() }));
      return {
        content: {
          left_items: leftItems,
          right_items: rightItems,
          variant: values.mpVariant === 'halves' ? 'halves' : undefined,
        },
        expectedAnswers: {
          pairs: pairs.map((_, i) => ({ left_id: `l-${i}`, right_id: `r-${i}` })),
        },
      };
    }
    case 'short_answer': {
      // `|`, not a comma — these answers are whole sentences and often contain
      // one. See the note on `saAccepted` in schemas/exercise.ts.
      const accepted = splitChunks(values.saAccepted ?? '');
      return {
        content: {
          question: values.saQuestion?.trim() ?? '',
          context: values.saContext?.trim() || undefined,
        },
        expectedAnswers: {
          reference_answer: values.saReferenceAnswer?.trim() ?? '',
          accepted_answers: accepted.length > 0 ? accepted : undefined,
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
          options: topics.length > 0 ? topics : undefined,
          min_words: Number.isFinite(minWords) && minWords > 0 ? minWords : undefined,
        },
        expectedAnswers: {
          rubric: values.wtRubric?.trim() || undefined,
        },
      };
    }
    case 'word_bank_fill': {
      const wordBank = splitCsv(values.wbfWordBank);
      const sentences = (values.wbfSentences ?? []).filter((s) => s.text.trim());
      const items = sentences.map((s, i) => ({
        id: `${i + 1}`,
        text_with_blanks: s.text.trim(),
      }));
      // Blank ids come from the markers themselves, so ___2___ stays blank 2
      // even if the author skipped ___1___ in that sentence.
      const answerItems = sentences.map((s, i) => ({
        id: `${i + 1}`,
        blanks: blankIds(s.text).map((blankId, j) => ({
          blank_id: blankId,
          accepted_answers: splitCsv(s.answers?.[j]),
          rationale: buildRationale(s.rationales?.[j] ?? {}),
        })),
      }));
      const wordNotes = Object.fromEntries(
        (values.wbfWordNotes ?? [])
          .filter((entry) => entry.word.trim() && entry.note.trim())
          .map((entry) => [entry.word.trim(), entry.note.trim()]),
      );
      return {
        content: {
          word_bank: wordBank,
          items,
          word_notes: Object.keys(wordNotes).length > 0 ? wordNotes : undefined,
        },
        expectedAnswers: { items: answerItems },
      };
    }
    case 'text_order': {
      const lines = (values.toLines ?? []).filter((l) => l.text.trim());
      const items = lines.map((l, i) => ({
        id: `line-${i}`,
        text: l.text.trim(),
        speaker: l.speaker?.trim() || undefined,
      }));
      return {
        content: { items, kind: values.toKind ?? 'dialogue' },
        // The authored order is the answer; content order carries no meaning.
        expectedAnswers: { order: items.map((i) => i.id) },
      };
    }
    case 'error_correction': {
      const sentences = (values.ecSentences ?? []).filter((s) => s.chunks.trim());
      const items = sentences.map((sentence, i) => ({
        id: `s-${i}`,
        chunks: splitChunks(sentence.chunks).map((text, j) => ({ id: `c-${j}`, text })),
      }));
      const corrections = sentences.flatMap((sentence, i) =>
        (sentence.fixes ?? [])
          .filter((fix) => fix.accepted.trim() && fix.chunkIndex.trim())
          .map((fix) => ({
            item_id: `s-${i}`,
            // Authors count parts from 1; ids are 0-based.
            chunk_id: `c-${Number(fix.chunkIndex) - 1}`,
            accepted: splitCsv(fix.accepted),
            note: fix.note?.trim() || undefined,
          })),
      );
      return {
        content: { items, mistake_count: corrections.length },
        expectedAnswers: { corrections },
      };
    }
    case 'sentence_schema': {
      // Keep only labelled fields; remember original index -> stable field id so
      // token assignments (by original index) survive the filtering.
      const fieldIdByOriginalIndex = new Map<number, string>();
      const fields: Array<{ id: string; label: string }> = [];
      (values.ssFields ?? []).forEach((f, originalIndex) => {
        if (f.label.trim()) {
          const fieldId = `f-${fields.length}`;
          fieldIdByOriginalIndex.set(originalIndex, fieldId);
          fields.push({ id: fieldId, label: f.label.trim() });
        }
      });

      const tokens: Array<{ id: string; text: string }> = [];
      // Token order within a field follows the order tokens appear in the list.
      const tokenIdsByFieldId = new Map<string, string[]>();
      (values.ssTokens ?? []).forEach((tk) => {
        if (!tk.text.trim()) return;
        const tokenId = `t-${tokens.length}`;
        tokens.push({ id: tokenId, text: tk.text.trim() });
        const fieldId = fieldIdByOriginalIndex.get(tk.fieldIndex);
        if (fieldId) {
          const arr = tokenIdsByFieldId.get(fieldId) ?? [];
          arr.push(tokenId);
          tokenIdsByFieldId.set(fieldId, arr);
        }
      });

      const placements = fields.map((f) => ({
        field_id: f.id,
        token_ids: tokenIdsByFieldId.get(f.id) ?? [],
      }));

      return {
        content: {
          sentence: values.ssSentence?.trim() ?? '',
          source_sentence: values.ssSourceSentence?.trim() || undefined,
          schema_type: values.ssSchemaType ?? 'main',
          fields,
          tokens,
        },
        expectedAnswers: { placements },
      };
    }
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Identity of an array element, used to line a rebuilt array up with the stored
 * one. Covers the three id shapes the template schemas use: `id`, the
 * `blank_id` of a fill blank, and the `item_id` + `chunk_id` pair of an
 * `error_correction` correction. Anything else (plain strings, `pairs`,
 * `placements`) has no handle and is replaced wholesale.
 *
 * Caveat: most of these ids are positional (`opt-0`, `s-1`, `"2"`), because
 * that is all the builder can mint. Reordering questions therefore hands a
 * question the unmodelled keys of whoever previously held its position. Adding
 * or deleting one has the same effect. Stable ids would fix it; until then the
 * merge is only safe for edits in place.
 */
function elementKey(value: unknown): string | null {
  if (!isPlainObject(value)) return null;
  const { id, blank_id: blankId, item_id: itemId, chunk_id: chunkId } = value;
  if (typeof id === 'string' || typeof id === 'number') return `id:${id}`;
  if (typeof blankId === 'string' || typeof blankId === 'number') return `blank:${blankId}`;
  if (itemId !== undefined && chunkId !== undefined) {
    return `correction:${String(itemId)}:${String(chunkId)}`;
  }
  return null;
}

/** Drops keys the builder marked as "form-owned and empty". */
function stripUndefined(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) out[key] = stripUndefined(entry);
  }
  return out;
}

function mergeArray(previous: unknown[], next: unknown[]): unknown[] {
  const byKey = new Map<string, unknown>();
  for (const element of previous) {
    const key = elementKey(element);
    if (key !== null) byKey.set(key, element);
  }
  return next.map((element) => {
    const key = elementKey(element);
    const match = key !== null ? byKey.get(key) : undefined;
    return match !== undefined ? mergeValue(match, element) : stripUndefined(element);
  });
}

function mergeValue(previous: unknown, next: unknown): unknown {
  if (Array.isArray(next)) {
    return Array.isArray(previous) ? mergeArray(previous, next) : stripUndefined(next);
  }
  if (isPlainObject(next) && isPlainObject(previous)) {
    const out: Record<string, unknown> = { ...previous };
    for (const [key, entry] of Object.entries(next)) {
      if (entry === undefined) delete out[key];
      else out[key] = mergeValue(previous[key], entry);
    }
    return out;
  }
  return stripUndefined(next);
}

/**
 * Form model → `{ content, expectedAnswers }`, merged over what is already stored.
 *
 * The form models only a subset of each template's schema — `word_bank_fill`
 * alone carries `input_mode`, `reusable_words`, `word_notes` and per-blank
 * `rationale` that no field reaches. Rebuilding from the form alone would
 * delete all of it on the first save, so `previous` (the exercise as the
 * backend has it) is merged under the rebuilt payload.
 *
 * The consequence, accepted for now: a key the form does not model can never be
 * removed through the UI, because the merge has no way to hear "delete this"
 * from a form that never mentions it. Clearing a field the form *does* model
 * works — the builder emits an explicit `undefined` for those.
 */
export function buildExercisePayload(
  values: ExerciseFormValues,
  previous?: Partial<ExercisePayload> | null,
): ExercisePayload {
  const raw = rawExercisePayload(values);
  return {
    content: mergeValue(previous?.content ?? {}, raw.content) as Record<string, unknown>,
    expectedAnswers: mergeValue(previous?.expectedAnswers ?? {}, raw.expectedAnswers) as Record<
      string,
      unknown
    >,
  };
}

interface EcContentItem {
  id?: unknown;
  chunks?: unknown[];
}

interface EcCorrection {
  item_id?: unknown;
  chunk_id?: unknown;
  accepted?: unknown;
  note?: unknown;
}

interface TextOrderItem {
  id?: unknown;
  text?: unknown;
  speaker?: unknown;
}

interface WbfContentItem {
  id?: unknown;
  text_with_blanks?: unknown;
}

interface WbfAnswerItem {
  id?: unknown;
  blanks?: Array<{ blank_id?: unknown; accepted_answers?: unknown; rationale?: unknown }>;
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
  const known = (
    EXERCISE_TYPES_SET.has(templateCode) ? templateCode : 'multiple_choice'
  ) as ExerciseType;
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
          options.length >= 2
            ? options.map((o) => ({ text: o.text }))
            : [{ text: '' }, { text: '' }],
        mcCorrectIndex: correctIndex,
      };
    }
    case 'multiple_choice_group': {
      const readOptions = (value: unknown) =>
        (Array.isArray(value) ? (value as McqOption[]) : []).map((o) => ({
          id: typeof o.id === 'string' ? o.id : '',
          text: typeof o.text === 'string' ? o.text : '',
        }));

      const shared = readOptions(content.options);
      const rawItems = Array.isArray(content.items)
        ? (content.items as Array<{ id?: unknown; question?: unknown; options?: unknown }>)
        : [];
      const rawAnswers = Array.isArray(expectedAnswers.items)
        ? (expectedAnswers.items as Array<{
            id?: unknown;
            correct_option_ids?: unknown;
            explanation?: unknown;
          }>)
        : [];
      const answersById = new Map(rawAnswers.map((a) => [String(a.id ?? ''), a]));

      const items = rawItems.map((item) => {
        const own = readOptions(item.options);
        const resolved = own.length > 0 ? own : shared;
        const key = answersById.get(String(item.id ?? ''));
        const correctIds = Array.isArray(key?.correct_option_ids)
          ? (key.correct_option_ids as unknown[]).map(String)
          : [];
        return {
          question: typeof item.question === 'string' ? item.question : '',
          // An empty list is what marks the question as using the shared column.
          options: own.map((o) => ({ text: o.text })),
          correctIndex: Math.max(
            resolved.findIndex((o) => correctIds.includes(o.id)),
            0,
          ),
          explanation: typeof key?.explanation === 'string' ? key.explanation : '',
        };
      });

      return {
        ...base,
        mcgContext: typeof content.context === 'string' ? content.context : '',
        mcgSharedOptions:
          shared.length > 0 ? shared.map((o) => ({ text: o.text })) : [{ text: '' }, { text: '' }],
        mcgItems: items.length > 0 ? items : DEFAULT_EXERCISE_VALUES.mcgItems,
      };
    }
    case 'fill_in_blank': {
      const rawBlanks = Array.isArray(expectedAnswers.blanks)
        ? (expectedAnswers.blanks as Array<{ blank_id?: unknown; accepted_answers?: unknown }>)
        : [];
      const blanks = rawBlanks
        .slice()
        .sort((a, b) => Number(a.blank_id ?? 0) - Number(b.blank_id ?? 0))
        .map((b) => {
          const rationale = parseRationale((b as { rationale?: unknown }).rationale);
          return {
            answers: Array.isArray(b.accepted_answers)
              ? (b.accepted_answers as unknown[]).map(String).join(', ')
              : '',
            rationaleExplanation: rationale.explanation ?? '',
            rationaleOptions: rationale.options ?? [],
          };
        });
      const wordBank = Array.isArray(content.word_bank)
        ? (content.word_bank as unknown[]).map(String).join(', ')
        : '';
      return {
        ...base,
        fibText: typeof content.text_with_blanks === 'string' ? content.text_with_blanks : '',
        fibBlanks:
          blanks.length > 0
            ? blanks
            : [{ answers: '', rationaleExplanation: '', rationaleOptions: [] }],
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
        trSourceLanguage:
          typeof content.source_language === 'string' ? content.source_language : '',
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
      const rightByLeftId = new Map(
        answerPairs.map((p) => [String(p.left_id), String(p.right_id)]),
      );
      const pairs = leftItems.map((l) => {
        const rightId = rightByLeftId.get(String(l.id));
        return {
          left: typeof l.text === 'string' ? l.text : '',
          right: rightId ? (rightById.get(rightId) ?? '') : '',
        };
      });
      return {
        ...base,
        mpVariant: content.variant === 'halves' ? 'halves' : 'pairs',
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
        ? (expectedAnswers.accepted_answers as unknown[]).map(String).join(' | ')
        : '';
      return {
        ...base,
        saQuestion: typeof content.question === 'string' ? content.question : '',
        saContext: typeof content.context === 'string' ? content.context : '',
        saReferenceAnswer:
          typeof expectedAnswers.reference_answer === 'string'
            ? expectedAnswers.reference_answer
            : '',
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
    case 'error_correction': {
      const rawItems = Array.isArray(content.items) ? (content.items as EcContentItem[]) : [];
      const rawCorrections = Array.isArray(expectedAnswers.corrections)
        ? (expectedAnswers.corrections as EcCorrection[])
        : [];
      const sentences = rawItems.map((item) => {
        const chunks = Array.isArray(item.chunks) ? item.chunks : [];
        const indexById = new Map(
          chunks.map((chunk, i) => [String((chunk as { id?: unknown }).id ?? ''), i + 1]),
        );
        const fixes = rawCorrections
          .filter((cor) => String(cor.item_id ?? '') === String(item.id ?? ''))
          .map((cor) => ({
            chunkIndex: String(indexById.get(String(cor.chunk_id ?? '')) ?? ''),
            accepted: (Array.isArray(cor.accepted) ? cor.accepted : [])
              .filter((a): a is string => typeof a === 'string')
              .join(', '),
            note: typeof cor.note === 'string' ? cor.note : '',
          }));
        return {
          chunks: chunks
            .map((chunk) =>
              typeof (chunk as { text?: unknown }).text === 'string'
                ? (chunk as { text: string }).text
                : '',
            )
            .join(' | '),
          fixes: fixes.length > 0 ? fixes : [{ chunkIndex: '', accepted: '', note: '' }],
        };
      });
      return {
        ...base,
        ecSentences: sentences.length > 0 ? sentences : DEFAULT_EXERCISE_VALUES.ecSentences,
      };
    }
    case 'text_order': {
      const rawItems = Array.isArray(content.items) ? (content.items as TextOrderItem[]) : [];
      const byId = new Map(rawItems.map((it) => [String(it.id ?? ''), it]));
      const order = Array.isArray(expectedAnswers.order)
        ? (expectedAnswers.order as unknown[]).filter((id): id is string => typeof id === 'string')
        : [];
      // The authored order lives in expectedAnswers; content order is arbitrary.
      const ordered =
        order.length > 0 ? order.map((id) => byId.get(id)).filter((it) => it != null) : rawItems;
      const lines = ordered.map((it) => ({
        text: typeof it!.text === 'string' ? it!.text : '',
        speaker: typeof it!.speaker === 'string' ? it!.speaker : '',
      }));
      return {
        ...base,
        toKind: content.kind === 'sentences' ? 'sentences' : 'dialogue',
        toLines: lines.length > 0 ? lines : DEFAULT_EXERCISE_VALUES.toLines,
      };
    }
    case 'word_bank_fill': {
      const bank = Array.isArray(content.word_bank)
        ? (content.word_bank as unknown[]).filter((w): w is string => typeof w === 'string')
        : [];
      const rawItems = Array.isArray(content.items) ? (content.items as WbfContentItem[]) : [];
      const rawAnswers = Array.isArray(expectedAnswers.items)
        ? (expectedAnswers.items as WbfAnswerItem[])
        : [];
      const answersById = new Map(
        rawAnswers.map((a) => [String(a.id ?? ''), Array.isArray(a.blanks) ? a.blanks : []]),
      );
      const sentences = rawItems.map((item) => {
        const text = typeof item.text_with_blanks === 'string' ? item.text_with_blanks : '';
        const blanks = answersById.get(String(item.id ?? '')) ?? [];
        const byBlankId = new Map(blanks.map((b) => [Number(b.blank_id), b]));
        const ids = blankIds(text);
        return {
          text,
          answers: ids.map((id) =>
            (Array.isArray(byBlankId.get(id)?.accepted_answers)
              ? (byBlankId.get(id)!.accepted_answers as unknown[])
              : []
            )
              .filter((a): a is string => typeof a === 'string')
              .join(', '),
          ),
          rationales: ids.map((id) => parseRationale(byBlankId.get(id)?.rationale)),
        };
      });
      const wordNotes = isPlainObject(content.word_notes) ? content.word_notes : {};
      return {
        ...base,
        wbfWordBank: bank.join(', '),
        wbfSentences: sentences.length > 0 ? sentences : DEFAULT_EXERCISE_VALUES.wbfSentences,
        wbfWordNotes: Object.entries(wordNotes)
          .filter(([, note]) => typeof note === 'string')
          .map(([word, note]) => ({ word, note: note as string })),
      };
    }
    case 'sentence_schema': {
      const rawFields = Array.isArray(content.fields)
        ? (content.fields as Array<{ id?: unknown; label?: unknown }>)
        : [];
      const fields = rawFields.map((f) => ({
        label: typeof f.label === 'string' ? f.label : '',
      }));
      const fieldIndexById = new Map<string, number>(rawFields.map((f, i) => [String(f.id), i]));

      // Reconstruct each token's field from the placements.
      const placements = Array.isArray(expectedAnswers.placements)
        ? (expectedAnswers.placements as Array<{ field_id?: unknown; token_ids?: unknown }>)
        : [];
      const fieldIdByTokenId = new Map<string, string>();
      for (const p of placements) {
        const tokenIds = Array.isArray(p.token_ids) ? (p.token_ids as unknown[]) : [];
        for (const tid of tokenIds) fieldIdByTokenId.set(String(tid), String(p.field_id));
      }

      const rawTokens = Array.isArray(content.tokens)
        ? (content.tokens as Array<{ id?: unknown; text?: unknown }>)
        : [];
      const tokens = rawTokens.map((tk) => {
        const fieldId = fieldIdByTokenId.get(String(tk.id));
        const fieldIndex = fieldId !== undefined ? (fieldIndexById.get(fieldId) ?? -1) : -1;
        return { text: typeof tk.text === 'string' ? tk.text : '', fieldIndex };
      });

      const schemaType =
        content.schema_type === 'subordinate' ? ('subordinate' as const) : ('main' as const);

      return {
        ...base,
        ssSentence: typeof content.sentence === 'string' ? content.sentence : '',
        ssSourceSentence:
          typeof content.source_sentence === 'string' ? content.source_sentence : '',
        ssSchemaType: schemaType,
        ssFields: fields.length >= 2 ? fields : [{ label: '' }, { label: '' }],
        ssTokens:
          tokens.length >= 2
            ? tokens
            : [
                { text: '', fieldIndex: 0 },
                { text: '', fieldIndex: 0 },
              ],
      };
    }
  }
}
