import { z } from 'zod';

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const hhmmSchema = z.string().regex(HHMM_RE, 'Must be HH:MM (24h)');
const isodateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const slotSchema = z
  .object({
    id: z.string().optional(),
    day: z.enum(WEEKDAYS),
    start: hhmmSchema,
    end: hhmmSchema,
    room: z.string().min(1, 'Room is required'),
  })
  .refine(
    (s) => {
      const [sh, sm] = s.start.split(':').map(Number);
      const [eh, em] = s.end.split(':').map(Number);
      return (sh ?? 0) * 60 + (sm ?? 0) < (eh ?? 0) * 60 + (em ?? 0);
    },
    { message: 'End time must be after start time', path: ['end'] },
  );

export const groupCreateSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100),
    courseId: z.string().uuid().nullable().optional(),
    lang: z.string().min(2).max(5),
    level: z.enum(CEFR),
    mode: z.enum(['online', 'in-person']),
    capacity: z.object({
      min: z.number().int().min(0),
      max: z.number().int().min(1),
    }),
    startDate: isodateSchema.nullable().optional(),
    endDate: isodateSchema.nullable().optional(),
  })
  .refine((d) => (d.capacity.min ?? 0) <= d.capacity.max, {
    message: 'Minimum must be ≤ maximum',
    path: ['capacity', 'min'],
  });

export const teacherAssignSchema = z
  .object({
    userId: z.string().min(1, 'Teacher is required'),
    role: z.enum(['primary', 'co-primary', 'substitute']),
    from: isodateSchema.optional(),
    to: isodateSchema.optional(),
    reason: z.string().optional(),
  })
  .refine(
    (d) => {
      if (d.role !== 'substitute') return true;
      return Boolean(d.reason && d.reason.trim().length > 0);
    },
    { message: 'Reason is required for substitutes', path: ['reason'] },
  )
  .refine(
    (d) => {
      if (!d.from || !d.to) return true;
      return d.from <= d.to;
    },
    { message: 'End date must be on or after start date', path: ['to'] },
  );

/**
 * Edit-context schema: same shape as create, plus a hard block on shrinking
 * capacity below the currently enrolled student count (unknowable at create time).
 */
export function groupEditSchema(studentCount: number) {
  return groupCreateSchema.superRefine((d, ctx) => {
    if (d.capacity.max < studentCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Max must be at least ${studentCount} (current enrollment)`,
        path: ['capacity', 'max'],
      });
    }
    if (d.startDate && d.endDate && d.endDate < d.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be on or after start date',
        path: ['endDate'],
      });
    }
  });
}

export type GroupCreateInput = z.infer<typeof groupCreateSchema>;
export type SlotInput = z.infer<typeof slotSchema>;
export type TeacherAssignInput = z.infer<typeof teacherAssignSchema>;
