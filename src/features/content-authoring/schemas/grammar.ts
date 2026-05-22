import { z } from 'zod';

export const grammarRuleFormSchema = z.object({
  title: z.string().min(1).max(200),
});
export type GrammarRuleFormValues = z.infer<typeof grammarRuleFormSchema>;

export const grammarExplanationFormSchema = z.object({
  languageCode: z.string().min(2).max(10),
  title: z.string().min(1).max(200),
  body: z.string().max(50_000).optional(),
  // Wrapped as objects so useFieldArray can manage them
  examples: z.array(z.object({ text: z.string().min(1).max(500) })),
});
export type GrammarExplanationFormValues = z.infer<typeof grammarExplanationFormSchema>;

// Combined form schema used by the inline editor
export const grammarEditorFormSchema = z.object({
  ruleTitle: z.string().min(1).max(200),
  languageCode: z.string().min(2).max(10),
  explanationTitle: z.string().min(1).max(200),
  body: z.string().max(50_000).optional(),
  examples: z.array(z.object({ text: z.string().min(1).max(500) })),
});
export type GrammarEditorFormValues = z.infer<typeof grammarEditorFormSchema>;
