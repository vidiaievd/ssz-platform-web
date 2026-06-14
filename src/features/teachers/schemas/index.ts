import { z } from 'zod';

const teachingLanguageRow = z.object({
  code: z.string().length(2),
  level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
});

export const teacherAddSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  email: z.string().email(),
  maxWeeklyContactHours: z.number().min(1).max(60),
  employmentType: z.enum(['full', 'part', 'contract']),
  teachingLanguages: z.array(teachingLanguageRow).min(1, 'at-least-one-language'),
});

export const availabilityBlockSchema = z.object({
  blockId: z.string().optional(),
  dayOfWeek: z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  type: z.enum(['available', 'preferred', 'unavailable']),
  recurring: z.boolean(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
}).refine((v) => v.startTime < v.endTime, {
  message: 'startTime must be before endTime',
  path: ['endTime'],
});

export const absenceReportSchema = z.object({
  kind: z.enum(['sick', 'leave', 'vacancy']),
  scope: z.enum(['today', 'window', 'permanent']),
  from: z.string(),
  to: z.string().nullable(),
  reason: z.string().min(1).max(500),
}).refine(
  (v) => {
    if (v.scope === 'permanent') return v.to === null;
    if (v.to) return v.from <= v.to;
    return true;
  },
  { message: 'to must be after from, or null for permanent absences', path: ['to'] },
);

export const subAssignSchema = z.object({
  substituteTeacherId: z.string().min(1),
  override: z.boolean().optional(),
});

export const forecastParamsSchema = z.object({
  growth: z.number().min(0).max(5),
  terms: z.number().int().min(1).max(20),
  groupSize: z.number().int().min(1).max(50),
  hoursPerGroup: z.number().min(0.5).max(40),
  contractPerTeacher: z.number().min(1).max(60),
});

export const curriculumUnitSchema = z.object({
  unitId: z.string().min(1),
  title: z.string().min(1).max(200),
  order: z.number().int().min(1),
  plannedSessions: z.number().int().min(0),
  deliveredSessions: z.number().int().min(0),
  requiredLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  status: z.enum(['planned', 'active', 'done', 'overridden']),
});

export type TeachingLanguageRow = z.infer<typeof teachingLanguageRow>;
export type TeacherAddInput = z.infer<typeof teacherAddSchema>;
export type AvailabilityBlockInput = z.infer<typeof availabilityBlockSchema>;
export type AbsenceReportInput = z.infer<typeof absenceReportSchema>;
export type SubAssignInput = z.infer<typeof subAssignSchema>;
export type ForecastParamsInput = z.infer<typeof forecastParamsSchema>;
export type CurriculumUnitInput = z.infer<typeof curriculumUnitSchema>;
