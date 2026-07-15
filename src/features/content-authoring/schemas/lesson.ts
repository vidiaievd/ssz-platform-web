import { z } from 'zod';

export const lessonFormSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(50_000).optional(),
});

export type LessonFormValues = z.infer<typeof lessonFormSchema>;

export const paragraphTranslationEntrySchema = z.object({
  paragraphIndex: z.number().int().min(0),
  translation: z.string().min(1).max(2_000),
});

export const paragraphTranslationsSchema = z.array(paragraphTranslationEntrySchema);

export type ParagraphTranslationEntry = z.infer<typeof paragraphTranslationEntrySchema>;

export const videoCueEntrySchema = z.object({
  position: z.number().int().min(0),
  startSeconds: z.number().min(0),
  targetLine: z.string().min(1).max(2_000),
  translationLine: z.string().max(2_000).optional(),
});

export const videoCuesSchema = z.array(videoCueEntrySchema);

export type VideoCueEntry = z.infer<typeof videoCueEntrySchema>;
