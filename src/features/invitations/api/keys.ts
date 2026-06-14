export const invitationCacheTags = {
  list: (schoolId: string) => `invitations:${schoolId}`,
  tutoring: () => 'invitations:tutoring',
} as const;
