import { http, HttpResponse } from 'msw';

import { MOCK_SCHOOLS } from '@/app/api/discovery/schools/route';
import type { SchoolsResponse } from '@/features/discovery/types';

/**
 * Default handlers shared across tests, dev, and Storybook.
 * Feature-specific handlers live next to their features and are
 * appended via `server.use(...)` / `worker.use(...)`.
 */
export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ ok: true })),

  http.get('/api/discovery/schools', ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();
    const language = url.searchParams.get('language');
    const level = url.searchParams.get('level');
    const type = url.searchParams.get('type');

    let results = MOCK_SCHOOLS;
    if (search)
      results = results.filter(
        (s) => s.name.toLowerCase().includes(search) || s.description?.toLowerCase().includes(search),
      );
    if (language) results = results.filter((s) => s.targetLanguages.includes(language));
    if (level) results = results.filter((s) => s.levels.includes(level as never));
    if (type) results = results.filter((s) => s.type === type);

    const response: SchoolsResponse = {
      items: results,
      pageInfo: { hasNextPage: false, total: results.length },
    };
    return HttpResponse.json(response);
  }),
];
