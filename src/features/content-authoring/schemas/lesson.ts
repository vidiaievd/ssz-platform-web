import { z } from 'zod';

export const lessonFormSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(50_000).optional(),
  /** Full transcript of the listening track. AUDIO-kind lessons only (BE1.3). */
  transcript: z.string().max(50_000).optional(),
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

/** LIVE-kind lesson schedule fields (BE1.6). All nullable — pass null to clear. */
export const liveScheduleSchema = z.object({
  title: z.string().min(1).max(200),
  liveStartsAt: z.string().datetime().nullable(),
  liveDurationMinutes: z.number().int().min(1).max(480).nullable(),
  liveJoinUrl: z.string().url().max(500).nullable().or(z.literal('').transform(() => null)),
  liveCapacity: z.number().int().min(1).nullable(),
});

export type LiveScheduleFormValues = z.infer<typeof liveScheduleSchema>;

export const listeningStageEntrySchema = z.object({
  exerciseId: z.string().min(1),
  position: z.number().int().min(0),
  stageType: z.enum(['gap_fill', 'comprehension']),
});

export const listeningStagesSchema = z.array(listeningStageEntrySchema);

export type ListeningStageEntry = z.infer<typeof listeningStageEntrySchema>;
