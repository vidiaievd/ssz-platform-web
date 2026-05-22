import { z } from 'zod';

export const difficultyLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const containerTypes = ['COURSE', 'MODULE', 'COLLECTION'] as const;
export const accessTiers = ['PUBLIC', 'FREE_WITHIN_SCHOOL', 'PAID', 'INVITE_ONLY'] as const;

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const containerFormSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  type: z.enum(containerTypes),
  targetLanguage: z.string().min(2).max(10),
  instructionLanguage: z.string().max(10).optional(),
  level: z.enum(difficultyLevels).optional(),
  // Optional in the form — Server Action validates presence for create.
  slug: z.string().max(200).regex(slugRegex, 'Only lowercase letters, numbers, and hyphens').optional(),
  accessTier: z.enum(accessTiers),
});

export type ContainerFormValues = z.infer<typeof containerFormSchema>;
