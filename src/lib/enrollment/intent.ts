export type EntryIntent =
  | { kind: 'explore' }
  | { kind: 'join_school'; schoolSlug: string }
  | { kind: 'invited'; token: string };

/**
 * Derives registration intent from URL search params.
 * Priority: invite token > school slug > default explore.
 * Intent is derived from entry point, never asked of the user.
 */
export function resolveIntent(searchParams: URLSearchParams): EntryIntent {
  const invite = searchParams.get('invite');
  if (invite) return { kind: 'invited', token: invite };

  const school = searchParams.get('school');
  if (school) return { kind: 'join_school', schoolSlug: school };

  return { kind: 'explore' };
}
