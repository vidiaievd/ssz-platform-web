import { z } from 'zod';

// ── Email / CSV enroll schema ─────────────────────────────────────────────────

export const enrollEmailSchema = z
  .string()
  .email('Invalid email address');

export const enrollCsvSchema = z
  .string()
  .min(1, 'CSV content is required')
  .transform((csv) =>
    csv
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter(Boolean),
  );

export const enrollFormSchema = z.object({
  emails: z
    .string()
    .min(1, 'At least one email is required')
    .transform((input) =>
      input
        .split(/[\n,;]+/)
        .map((e) => e.trim())
        .filter(Boolean),
    ),
  targetGroupId: z.string().optional(),
});

export type EnrollFormInput = z.input<typeof enrollFormSchema>;
export type EnrollFormOutput = z.output<typeof enrollFormSchema>;

// Validate each parsed email
export const enrollEmailsSchema = z
  .array(enrollEmailSchema)
  .min(1, 'At least one valid email is required');

// ── Segment schema ────────────────────────────────────────────────────────────

export const segmentPredicateSchema = z.object({
  status: z
    .union([
      z.enum(['active', 'at-risk', 'new', 'finished', 'clash', 'unassigned']),
      z.array(z.enum(['active', 'at-risk', 'new', 'finished', 'clash', 'unassigned'])),
    ])
    .optional(),
  inactiveDays: z.number().int().positive().optional(),
  minGroups: z.number().int().nonnegative().optional(),
  maxGroups: z.number().int().nonnegative().optional(),
});

export const saveSegmentSchema = z.object({
  name: z.string().min(1, 'Segment name is required').max(80),
  predicate: segmentPredicateSchema,
});

export type SaveSegmentInput = z.infer<typeof saveSegmentSchema>;

// ── Bulk message schema ───────────────────────────────────────────────────────

export const bulkMessageSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200),
  body: z.string().min(1, 'Message body is required').max(5000),
});

export type BulkMessageInput = z.infer<typeof bulkMessageSchema>;
