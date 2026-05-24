import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { Container, PaginatedResponse } from '@/features/content/types';
import type { ContainerProgress } from '@/features/student/types';
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

// Raw shape returned by the Learning Service.
const RawProgressItem = z.object({
  id: z.string(),
  containerId: z.string(),
  completedItems: z.number().int().min(0).default(0),
  totalItems: z.number().int().min(0).default(0),
  progressPercent: z.number().min(0).max(100).default(0),
  lastAccessedAt: z.string().optional(),
  nextItemId: z.string().optional(),
  nextItemTitle: z.string().optional(),
  nextItemType: z.string().optional(),
});

const RawProgressList = z.array(RawProgressItem);

export async function GET() {
  try {
    // Parallel: fetch progress records + enrolled containers.
    const [rawProgress, containersData] = await Promise.all([
      serverFetch({ service: 'progress', path: '/api/v1/progress' }),
      serverFetch<PaginatedResponse<Container>>({
        service: 'content',
        path: '/api/v1/containers',
        query: { enrolled: 'true', pageSize: '100' },
      }),
    ]);

    const parsed = RawProgressList.safeParse(rawProgress);
    if (!parsed.success) {
      return NextResponse.json([], { status: 200 });
    }

    const containerMap = new Map<string, Container>(
      (containersData.items ?? []).map((c) => [c.id, c]),
    );

    const progress: ContainerProgress[] = parsed.data.flatMap((item) => {
      const container = containerMap.get(item.containerId);
      if (!container) return [];
      return [
        {
          id: item.id,
          containerId: item.containerId,
          containerSlug: container.slug,
          containerTitle: container.title,
          containerType: container.type,
          targetLanguage: container.targetLanguage,
          level: container.level,
          coverImageUrl: container.coverImageUrl,
          completedItems: item.completedItems,
          totalItems: item.totalItems,
          progressPercent: item.progressPercent,
          lastAccessedAt: item.lastAccessedAt,
          nextItemId: item.nextItemId,
          nextItemTitle: item.nextItemTitle,
          nextItemType: item.nextItemType as ContainerProgress['nextItemType'],
        },
      ];
    });

    return NextResponse.json(progress);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 502 });
  }
}
