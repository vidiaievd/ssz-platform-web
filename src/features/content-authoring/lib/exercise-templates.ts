import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import type { ExerciseTemplate } from '@/features/content/types';

// Exercise templates are static seed data (content-service prisma/seed.ts), so
// the code→id map is cached for the process lifetime. `POST /exercises` requires
// the UUID `exerciseTemplateId`, but the rest of the app works with the stable
// `code` (e.g. 'multiple_choice') — this is the single resolution point.
let cache: Promise<Map<string, string>> | null = null;

async function loadTemplateMap(): Promise<Map<string, string>> {
  const templates = await serverFetch<ExerciseTemplate[]>({
    service: 'content',
    path: '/exercise-templates',
    query: { onlyActive: true },
  });
  return new Map(templates.map((t) => [t.code, t.id]));
}

/** Resolves a template `code` (e.g. 'multiple_choice') to its backend UUID. */
export async function resolveExerciseTemplateId(code: string): Promise<string> {
  if (!cache) cache = loadTemplateMap().catch((e) => {
    cache = null; // don't cache failures
    throw e;
  });
  const map = await cache;
  const id = map.get(code);
  if (!id) {
    throw new AppError('not_found', `Unknown exercise template code: ${code}`);
  }
  return id;
}

/** Test-only: clears the process cache so each test starts cold. */
export function __resetExerciseTemplateCache(): void {
  cache = null;
}
