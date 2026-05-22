import { z } from 'zod';

export const EXERCISE_TYPES = ['cloze', 'multiple_choice', 'free_text', 'pronunciation'] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const DIFFICULTY_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const exerciseFormSchema = z
  .object({
    templateCode: z.enum(EXERCISE_TYPES),
    instructions: z.string().max(1000).optional(),
    difficultyLevel: z.enum(DIFFICULTY_LEVELS).optional(),
    // cloze
    clozeTemplate: z.string().max(5000).optional(),
    clozeAnswers: z.array(z.object({ text: z.string().min(1).max(200) })).optional(),
    // multiple choice
    mcQuestion: z.string().max(1000).optional(),
    mcOptions: z.array(z.object({ text: z.string().min(1).max(500) })).optional(),
    mcCorrectIndex: z.number().int().min(0).optional(),
    // free text
    ftPrompt: z.string().max(1000).optional(),
    ftSampleAnswer: z.string().max(2000).optional(),
    // pronunciation
    pronText: z.string().max(500).optional(),
    pronIpa: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.templateCode === 'cloze' && !data.clozeTemplate?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['clozeTemplate'], message: 'Required' });
    }
    if (data.templateCode === 'multiple_choice') {
      if (!data.mcQuestion?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mcQuestion'], message: 'Required' });
      }
      if (!data.mcOptions || data.mcOptions.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['mcOptions'],
          message: 'At least 2 options required',
        });
      }
    }
    if (data.templateCode === 'free_text' && !data.ftPrompt?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ftPrompt'], message: 'Required' });
    }
    if (data.templateCode === 'pronunciation' && !data.pronText?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pronText'], message: 'Required' });
    }
  });

export type ExerciseFormValues = z.infer<typeof exerciseFormSchema>;
