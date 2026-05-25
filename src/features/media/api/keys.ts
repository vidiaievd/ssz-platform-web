export const mediaKeys = {
  all: ['media'] as const,
  assets: () => [...mediaKeys.all, 'assets'] as const,
  asset: (id: string) => [...mediaKeys.assets(), id] as const,
};
