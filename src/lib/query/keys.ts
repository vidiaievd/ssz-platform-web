/**
 * Query keys are arrays whose first element is the feature name.
 * Each feature defines its own keys factory using `keyFactory`.
 *
 * Example:
 *   const profileKeys = keyFactory('profile', {
 *     all: () => [],
 *     detail: (id: string) => ['detail', id],
 *   });
 *   profileKeys.detail('abc'); // ['profile', 'detail', 'abc']
 */

type Keys = Record<string, (...args: never[]) => readonly unknown[]>;

export function keyFactory<TFeature extends string, TKeys extends Keys>(
  feature: TFeature,
  keys: TKeys,
): {
  [K in keyof TKeys]: (
    ...args: Parameters<TKeys[K]>
  ) => readonly [TFeature, ...ReturnType<TKeys[K]>];
} {
  const out = {} as {
    [K in keyof TKeys]: (
      ...args: Parameters<TKeys[K]>
    ) => readonly [TFeature, ...ReturnType<TKeys[K]>];
  };
  for (const k of Object.keys(keys) as (keyof TKeys)[]) {
    const fn = keys[k]!;
    out[k] = ((...args: never[]) =>
      [feature, ...fn(...args)] as const) as unknown as (typeof out)[typeof k];
  }
  return out;
}
