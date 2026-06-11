import { z } from 'zod';

export const InvitationRoleSchema = z.enum([
  'ADMIN',
  'CONTENT_ADMIN',
  'TEACHER',
  'STUDENT',
  'SCHEDULER',
]);

export const InvitationKindSchema = z.enum(['register', 'onboard_existing']);

export const InvitationStatusSchema = z.enum(['pending', 'accepted', 'expired', 'revoked']);

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

export const InvitePreviewSchema = z.object({
  schoolName: z.string(),
  schoolSlug: z.string(),
  role: InvitationRoleSchema,
  kind: InvitationKindSchema,
  email: z.string().email(),
  invitedByName: z.string().nullable(),
  status: InvitationStatusSchema,
  expiresAt: z.string(),
});

export type InvitePreviewSchemaType = z.infer<typeof InvitePreviewSchema>;
