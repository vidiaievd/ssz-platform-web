import { z } from 'zod';

export const difficultyLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const containerTypes = ['course', 'module', 'collection'] as const;
export const visibilities = ['public', 'school_private', 'shared', 'private'] as const;
export const accessTiers = [
  'assigned_only',
  'entitlement_required',
  'free_within_school',
  'public_free',
  'public_paid',
] as const;
export const levelSystems = ['cefr', 'custom', 'single'] as const;

export const containerFormSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  containerType: z.enum(containerTypes),
  targetLanguage: z.string().min(2).max(10),
  difficultyLevel: z.enum(difficultyLevels),
  visibility: z.enum(visibilities),
  accessTier: z.enum(accessTiers),
  // Create-time only (drives level-section scaffolding); never sent on update.
  levelSystem: z.enum(levelSystems).optional(),
});

export type ContainerFormValues = z.infer<typeof containerFormSchema>;
