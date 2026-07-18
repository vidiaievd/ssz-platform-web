import { z } from 'zod';

// Template codes mirror content-service's seeded exercise templates exactly
// (prisma/seed.ts). The backend resolves each code to an `exerciseTemplateId`
// (UUID) and validates content/expectedAnswers against the template's schemas.
export const EXERCISE_TYPES = [
  'multiple_choice',
  'fill_in_blank',
  'translate_to_target',
  'translate_from_target',
  'match_pairs',
  'short_answer',
  'writing_task',
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const DIFFICULTY_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const exerciseFormSchema = z
  .object({
    templateCode: z.enum(EXERCISE_TYPES),
    instructions: z.string().max(1000).optional(),
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

    // fill_in_blank — `fibText` uses ___1___, ___2___ markers; each blank has a
    // comma-separated list of accepted answers.
    fibText: z.string().max(5000).optional(),
    fibBlanks: z.array(z.object({ answers: z.string().max(500) })).optional(),
    fibWordBank: z.string().max(1000).optional(),

    // translate_to_target / translate_from_target
    trSourceText: z.string().max(2000).optional(),
    trSourceLanguage: z.string().max(10).optional(),
    trAcceptedTranslations: z.array(z.object({ text: z.string().max(1000) })).optional(),

    // match_pairs
    mpPairs: z
      .array(z.object({ left: z.string().max(500), right: z.string().max(500) }))
      .optional(),

    // short_answer — `saAccepted` is a comma-separated list of exact-match
    // shortcuts; a non-matching answer is routed for review by the engine.
    saQuestion: z.string().max(2000).optional(),
    saContext: z.string().max(2000).optional(),
    saReferenceAnswer: z.string().max(2000).optional(),
    saAccepted: z.string().max(2000).optional(),

    // writing_task — `wtTopics` are optional "choose one" prompts.
    wtPrompt: z.string().max(2000).optional(),
    wtMinWords: z.string().max(6).optional(),
    wtTopics: z.array(z.object({ title: z.string().max(500) })).optional(),
    wtRubric: z.string().max(2000).optional(),
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
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['trSourceText'], message: 'Required' });
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
    }
  });

export type ExerciseFormValues = z.infer<typeof exerciseFormSchema>;
