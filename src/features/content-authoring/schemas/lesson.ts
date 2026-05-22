import { z } from 'zod';

export const lessonFormSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(50_000).optional(),
});

export type LessonFormValues = z.infer<typeof lessonFormSchema>;
