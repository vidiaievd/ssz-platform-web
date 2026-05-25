import { z } from 'zod';

export const basicsSchema = z.object({
  name: z.string().trim().min(3, 'min').max(60, 'max'),
  description: z.string().max(500, 'max').optional(),
  logoUrl: z.string().url('url').optional().or(z.literal('')),
});

export type BasicsFormValues = z.infer<typeof basicsSchema>;

export const inviteRowSchema = z.object({
  email: z.string().trim().email('invalid'),
  role: z.enum(['TEACHER', 'CONTENT_ADMIN', 'STUDENT']),
});

export type InviteRowValues = z.infer<typeof inviteRowSchema>;

export const invitesSchema = z.object({
  rows: z
    .array(inviteRowSchema)
    .max(10, 'max')
    .refine(
      (rows) => {
        const emails = rows.map((r) => r.email.toLowerCase());
        return emails.length === new Set(emails).size;
      },
      { message: 'duplicate' },
    ),
});

export type InvitesFormValues = z.infer<typeof invitesSchema>;
