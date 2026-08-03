import 'server-only';

import { serverFetch } from '@/lib/api/server-fetcher';
import { env } from '@/lib/env';
import type { Container } from '@/features/content/types';

interface ContainerPublishSummary {
  containerId: string;
  publishState: Container['publishState'];
  pendingModuleCount: number;
}

/**
 * Adds "is anything here waiting to be released" to a page of the author's own
 * containers.
 *
 * `currentPublishedVersionId` — all the list endpoint returns — cannot answer
 * it: a course is published from the moment it goes live once, and says
 * nothing about the draft sitting ahead of it, nor about a module inside it
 * that students cannot open. Modules are versioned independently, so the count
 * has to come from the server too.
 *
 * Best-effort: the list is worth showing without the badge, so a failure here
 * leaves the containers untouched rather than failing the request.
 */
export async function attachPublishStates(containers: Container[]): Promise<Container[]> {
  if (containers.length === 0) return containers;

  try {
    const summaries = await serverFetch<ContainerPublishSummary[]>({
      service: 'content',
      path: '/internal/containers/publish-states',
      query: { ids: containers.map((c) => c.id).join(',') },
      directBaseUrl: env.CONTENT_SERVICE_INTERNAL_URL,
      headers: { 'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? '' },
      anonymous: true,
    });

    const byId = new Map(summaries.map((s) => [s.containerId, s]));

    return containers.map((container) => {
      const summary = byId.get(container.id);
      if (!summary) return container;
      return {
        ...container,
        publishState: summary.publishState,
        pendingModuleCount: summary.pendingModuleCount,
      };
    });
  } catch {
    return containers;
  }
}
