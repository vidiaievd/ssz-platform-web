export const schoolKeys = {
  all: ['schools'] as const,
  mine: () => [...schoolKeys.all, 'mine'] as const,
  detail: (id: string) => [...schoolKeys.all, 'detail', id] as const,
  nameAvailable: (name: string) => [...schoolKeys.all, 'name-available', name] as const,
  slugAvailable: (slug: string) => [...schoolKeys.all, 'slug-available', slug] as const,
  invitations: (schoolId: string) => [...schoolKeys.all, 'invitations', schoolId] as const,
};
