export const mediaKeys = {
  all: ['media'] as const,
  assets: () => [...mediaKeys.all, 'assets'] as const,
  asset: (id: string) => [...mediaKeys.assets(), id] as const,
  narrationDefaults: () => [...mediaKeys.all, 'narration-defaults'] as const,
  previous: (id: string) => [...mediaKeys.assets(), id, 'previous'] as const,
};
