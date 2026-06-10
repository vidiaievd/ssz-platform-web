import { z } from 'zod';

const InvitationRoleSchema = z.enum([
  'ADMIN',
  'CONTENT_ADMIN',
  'TEACHER',
  'STUDENT',
  'SCHEDULER',
]);

const InvitationKindSchema = z.enum(['register', 'onboard_existing']);

const InvitationStatusSchema = z.enum(['pending', 'accepted', 'expired', 'revoked']);

export const InvitationSchema = z.object({
  invitationId: z.string(),
  email: z.string().email(),
  role: InvitationRoleSchema,
  kind: InvitationKindSchema,
  status: InvitationStatusSchema,
  targetGroupId: z.string().nullable(),
  targetGroupName: z.string().nullable(),
  invitedByName: z.string().nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  acceptedAt: z.string().nullable(),
  lastSentAt: z.string(),
  resendCount: z.number().int().min(0),
  token: z.string().nullable().optional(),
});

export const InvitationsListSchema = z.array(InvitationSchema);

export const ResendResultSchema = z.object({
  expiresAt: z.string(),
  resendCount: z.number().int().min(0),
  lastSentAt: z.string(),
});

export type InvitationSchemaType = z.infer<typeof InvitationSchema>;
