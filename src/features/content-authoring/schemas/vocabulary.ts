import { z } from 'zod';

export const vocabularyListFormSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});
export type VocabularyListFormValues = z.infer<typeof vocabularyListFormSchema>;

export const translationRowSchema = z.object({
  languageCode: z.string().min(2).max(10),
  translation: z.string().min(1).max(200),
});

export const exampleRowSchema = z.object({
  // `serverId` holds the server-side ID when editing an existing example.
  // Named `serverId` (not `id`) to avoid collision with react-hook-form's internal field id.
  serverId: z.string().optional(),
  template: z.string().min(1).max(500),
  substitution: z.string().min(1).max(200),
});

export const vocabularyItemFormSchema = z.object({
  lemma: z.string().min(1).max(100),
  ipa: z.string().max(100).optional(),
  partOfSpeech: z.string().max(50).optional(),
  translations: z.array(translationRowSchema),
  examples: z.array(exampleRowSchema),
});
export type VocabularyItemFormValues = z.infer<typeof vocabularyItemFormSchema>;
