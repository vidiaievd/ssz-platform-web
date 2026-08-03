import { z } from 'zod';

// Template codes mirror content-service's seeded exercise templates exactly
// (prisma/seed.ts). The backend resolves each code to an `exerciseTemplateId`
// (UUID) and validates content/expectedAnswers against the template's schemas.
export const EXERCISE_TYPES = [
  'multiple_choice',
  'multiple_choice_group',
  'fill_in_blank',
  'translate_to_target',
  'translate_from_target',
  'match_pairs',
  'short_answer',
  'writing_task',
  'sentence_schema',
  'word_bank_fill',
  'text_order',
  'error_correction',
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const MATCH_VARIANTS = ['pairs', 'halves'] as const;

export const TEXT_ORDER_KINDS = ['dialogue', 'sentences'] as const;

export const SENTENCE_SCHEMA_TYPES = ['main', 'subordinate'] as const;

// Verdicts for a fill_in_blank rationale option: the accepted answer, one that
// is grammatical but not chosen in this context, and one that simply fails.
export const RATIONALE_VERDICTS = ['correct', 'acceptable', 'wrong'] as const;
export type RationaleVerdict = (typeof RATIONALE_VERDICTS)[number];

/** Comma-separated bank input → trimmed, non-empty words. */
const splitBank = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/** "a | b | c" → ["a", "b", "c"], dropping empty parts. */
export const splitChunks = (value: string): string[] =>
  value
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

/** How many `___N___` markers a sentence carries. */
export const countBlanks = (text: string): number => (text.match(/___\d+___/g) ?? []).length;

export const DIFFICULTY_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const exerciseFormSchema = z
  .object({
    templateCode: z.enum(EXERCISE_TYPES),
    // Required, not merely encouraged: content-service pre-flight raises
    // `EXERCISE_INCOMPLETE` as a *blocker* for an exercise with no
    // instruction row, so an exercise saved without one cannot be published
    // and the author only finds out on the review screen.
    instructions: z.string().min(1, 'Required').max(1000),
    hint: z.string().max(1000).optional(),
    difficultyLevel: z.enum(DIFFICULTY_LEVELS).optional(),

    // Item-level strings are NOT `.min(1)` here: the form always carries a full
    // set of default arrays (one per template), and only the active template's
    // entries are validated below. Emptiness is enforced per-active-type in the
    // superRefine, and empty entries are dropped when building the payload.

    // multiple_choice
    mcQuestion: z.string().max(1000).optional(),
    mcContext: z.string().max(1000).optional(),
    mcOptions: z.array(z.object({ text: z.string().max(500) })).optional(),
    mcCorrectIndex: z.number().int().min(0).optional(),

    // multiple_choice_group — several questions checked as one block.
    // `mcgSharedOptions` is the column every question answers with (Riktig /
    // Galt); a question that needs its own wording carries `options` of its own,
    // and an empty `options` array means "use the shared column". `correctIndex`
    // points into whichever of the two applies.
    mcgContext: z.string().max(1000).optional(),
    mcgSharedOptions: z.array(z.object({ text: z.string().max(500) })).optional(),
    mcgItems: z
      .array(
        z.object({
          question: z.string().max(1000),
          options: z.array(z.object({ text: z.string().max(500) })).optional(),
          correctIndex: z.number().int().min(0),
          explanation: z.string().max(1000).optional(),
        }),
      )
      .optional(),

    // fill_in_blank — `fibText` uses ___1___, ___2___ markers; each blank has a
    // comma-separated list of accepted answers, plus an optional rationale
    // matrix shown to the student as feedback after checking.
    fibText: z.string().max(5000).optional(),
    fibBlanks: z
      .array(
        z.object({
          answers: z.string().max(500),
          rationaleExplanation: z.string().max(1000).optional(),
          rationaleOptions: z
            .array(
              z.object({
                text: z.string().max(200),
                verdict: z.enum(RATIONALE_VERDICTS),
                note: z.string().max(500).optional(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
    fibWordBank: z.string().max(1000).optional(),

    // translate_to_target / translate_from_target
    trSourceText: z.string().max(2000).optional(),
    trSourceLanguage: z.string().max(10).optional(),
    trAcceptedTranslations: z.array(z.object({ text: z.string().max(1000) })).optional(),

    // match_pairs — `mpVariant` only changes presentation (word pairs vs
    // numbered/lettered sentence halves), never scoring.
    mpVariant: z.enum(MATCH_VARIANTS).optional(),
    mpPairs: z
      .array(z.object({ left: z.string().max(500), right: z.string().max(500) }))
      .optional(),

    // short_answer — `saAccepted` lists every acceptable phrasing, separated by
    // `|`. Not a comma: a transformation answer routinely contains one
    // ("Hadde jeg tid, ville jeg hjulpet"), and splitting on it would file half
    // a sentence as an answer of its own. The engine scores a submission
    // against the closest of these; only something far off goes for review.
    saQuestion: z.string().max(2000).optional(),
    saContext: z.string().max(2000).optional(),
    saReferenceAnswer: z.string().max(2000).optional(),
    saAccepted: z.string().max(2000).optional(),

    // writing_task — `wtTopics` are optional "choose one" prompts.
    wtPrompt: z.string().max(2000).optional(),
    wtMinWords: z.string().max(6).optional(),
    wtTopics: z.array(z.object({ title: z.string().max(500) })).optional(),
    wtRubric: z.string().max(2000).optional(),

    // sentence_schema — the learner drops sentence tokens into ordered fields.
    // Each token records which field (by index) it belongs to; -1 = unassigned.
    ssSentence: z.string().max(2000).optional(),
    // Optional starting point: when set the exercise becomes a transformation
    // and `ssSentence` is held back from the learner until the answer is checked.
    ssSourceSentence: z.string().max(2000).optional(),
    ssSchemaType: z.enum(SENTENCE_SCHEMA_TYPES).optional(),
    ssFields: z.array(z.object({ label: z.string().max(200) })).optional(),
    ssTokens: z
      .array(z.object({ text: z.string().max(200), fieldIndex: z.number().int() }))
      .optional(),

    // word_bank_fill — several sentences sharing one comma-separated bank.
    // `answers[j]` holds the accepted answers (comma-separated) for the j-th
    // ___N___ marker of that sentence, so a sentence may carry several blanks.
    wbfWordBank: z.string().max(2000).optional(),
    wbfSentences: z
      .array(
        z.object({
          text: z.string().max(1000),
          answers: z.array(z.string().max(500)).optional(),
        }),
      )
      .optional(),

    // text_order — the list order IS the correct order; the runner shuffles it
    // for the learner. `speaker` is an optional label for dialogue turns.
    toKind: z.enum(TEXT_ORDER_KINDS).optional(),
    toLines: z
      .array(z.object({ text: z.string().max(1000), speaker: z.string().max(100).optional() }))
      .optional(),

    // error_correction — each sentence is written as chunks separated by `|`,
    // and the faulty chunk is named by its 1-based position with the rewrite
    // that replaces it.
    ecSentences: z
      .array(
        z.object({
          chunks: z.string().max(2000),
          fixes: z
            .array(
              z.object({
                chunkIndex: z.string().max(4),
                accepted: z.string().max(500),
                note: z.string().max(500).optional(),
              }),
            )
            .optional(),
        }),
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    switch (data.templateCode) {
      case 'multiple_choice': {
        if (!data.mcQuestion?.trim()) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mcQuestion'], message: 'Required' });
        }
        if ((data.mcOptions ?? []).filter((o) => o.text.trim()).length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['mcOptions'],
            message: 'At least 2 options required',
          });
        }
        break;
      }
      case 'multiple_choice_group': {
        const shared = (data.mcgSharedOptions ?? []).filter((o) => o.text.trim());
        const items = (data.mcgItems ?? []).filter((it) => it.question.trim());
        if (items.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['mcgItems'],
            message: 'At least 1 question required',
          });
        }
        // The shared column only has to hold up for the questions that lean on it.
        const needsShared = items.some(
          (it) => (it.options ?? []).filter((o) => o.text.trim()).length === 0,
        );
        if (needsShared && shared.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['mcgSharedOptions'],
            message: 'At least 2 shared options required',
          });
        }
        items.forEach((item) => {
          const index = (data.mcgItems ?? []).indexOf(item);
          const own = (item.options ?? []).filter((o) => o.text.trim());
          if (own.length === 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['mcgItems', index, 'options'],
              message: 'At least 2 options required',
            });
          }
          const resolved = own.length > 0 ? own : shared;
          if (resolved.length >= 2 && item.correctIndex >= resolved.length) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['mcgItems', index, 'correctIndex'],
              message: 'Choose the correct answer',
            });
          }
        });
        break;
      }
      case 'fill_in_blank': {
        if (!data.fibText?.trim()) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fibText'], message: 'Required' });
        }
        if ((data.fibBlanks ?? []).filter((b) => b.answers.trim()).length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fibBlanks'],
            message: 'At least 1 blank required',
          });
        }
        break;
      }
      case 'translate_to_target':
      case 'translate_from_target': {
        if (!data.trSourceText?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['trSourceText'],
            message: 'Required',
          });
        }
        if (!(data.trAcceptedTranslations ?? []).some((tr) => tr.text.trim())) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['trAcceptedTranslations'],
            message: 'At least 1 accepted translation required',
          });
        }
        break;
      }
      case 'match_pairs': {
        if ((data.mpPairs ?? []).filter((p) => p.left.trim() && p.right.trim()).length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['mpPairs'],
            message: 'At least 2 complete pairs required',
          });
        }
        break;
      }
      case 'short_answer': {
        if (!data.saQuestion?.trim()) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['saQuestion'], message: 'Required' });
        }
        if (!data.saReferenceAnswer?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['saReferenceAnswer'],
            message: 'Required',
          });
        }
        break;
      }
      case 'writing_task': {
        if (!data.wtPrompt?.trim()) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['wtPrompt'], message: 'Required' });
        }
        break;
      }
      case 'word_bank_fill': {
        if (splitBank(data.wbfWordBank).length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['wbfWordBank'],
            message: 'At least 2 bank words required',
          });
        }
        const sentences = (data.wbfSentences ?? []).filter((s) => s.text.trim());
        if (sentences.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['wbfSentences'],
            message: 'At least 1 sentence required',
          });
        }
        sentences.forEach((sentence) => {
          const index = (data.wbfSentences ?? []).indexOf(sentence);
          const markers = countBlanks(sentence.text);
          if (markers === 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['wbfSentences', index, 'text'],
              message: 'Add a ___1___ blank',
            });
            return;
          }
          for (let j = 0; j < markers; j++) {
            if (!sentence.answers?.[j]?.trim()) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['wbfSentences', index, 'answers', j],
                message: 'Required',
              });
            }
          }
        });
        break;
      }
      case 'text_order': {
        if ((data.toLines ?? []).filter((l) => l.text.trim()).length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['toLines'],
            message: 'At least 2 lines required',
          });
        }
        break;
      }
      case 'error_correction': {
        const sentences = (data.ecSentences ?? []).filter((s) => s.chunks.trim());
        if (sentences.length < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ecSentences'],
            message: 'At least 1 sentence required',
          });
        }
        let fixCount = 0;
        sentences.forEach((sentence) => {
          const index = (data.ecSentences ?? []).indexOf(sentence);
          const chunkCount = splitChunks(sentence.chunks).length;
          if (chunkCount < 2) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['ecSentences', index, 'chunks'],
              message: 'Split the sentence into at least 2 parts with |',
            });
          }
          (sentence.fixes ?? []).forEach((fix, j) => {
            if (!fix.accepted.trim() && !fix.chunkIndex.trim()) return;
            fixCount += 1;
            const position = Number(fix.chunkIndex);
            if (!Number.isInteger(position) || position < 1 || position > chunkCount) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['ecSentences', index, 'fixes', j, 'chunkIndex'],
                message: `Part number between 1 and ${chunkCount}`,
              });
            }
            if (!fix.accepted.trim()) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['ecSentences', index, 'fixes', j, 'accepted'],
                message: 'Required',
              });
            }
          });
        });
        if (sentences.length > 0 && fixCount === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ecSentences'],
            message: 'At least 1 mistake required',
          });
        }
        break;
      }
      case 'sentence_schema': {
        if (!data.ssSentence?.trim()) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ssSentence'], message: 'Required' });
        }
        const labelledFields = (data.ssFields ?? []).filter((f) => f.label.trim());
        if (labelledFields.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ssFields'],
            message: 'At least 2 fields required',
          });
        }
        const filledTokens = (data.ssTokens ?? []).filter((tk) => tk.text.trim());
        if (filledTokens.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ssTokens'],
            message: 'At least 2 tokens required',
          });
        }
        // Every filled token must be assigned to a field with a non-empty label.
        const fieldCount = (data.ssFields ?? []).length;
        const hasUnassigned = filledTokens.some(
          (tk) =>
            tk.fieldIndex < 0 ||
            tk.fieldIndex >= fieldCount ||
            !(data.ssFields ?? [])[tk.fieldIndex]?.label.trim(),
        );
        if (hasUnassigned) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['ssTokens'],
            message: 'Every word must be assigned to a field',
          });
        }
        break;
      }
    }
  });

export type ExerciseFormValues = z.infer<typeof exerciseFormSchema>;
