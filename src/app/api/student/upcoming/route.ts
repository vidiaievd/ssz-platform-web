import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { Container } from '@/features/content/types';
import type { LessonPreview } from '@/features/student/types';
import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';

// Raw shape returned by the Progress Service.
const RawProgressItem = z.object({
  id: z.string(),
  containerId: z.string(),
  completedItems: z.number().int().min(0).default(0),
  totalItems: z.number().int().min(0).default(0),
  lastAccessedAt: z.string().optional(),
  nextItemId: z.string().optional(),
  nextItemTitle: z.string().optional(),
});

const RawProgressList = z.array(RawProgressItem);

const UPCOMING_LIMIT = 4;

export async function GET() {
  try {
    const [rawProgress, containersData] = await Promise.all([
      serverFetch({ service: 'progress', path: '/progress' }),
      serverFetch<{ items: Container[] }>({
        service: 'content',
        path: '/containers',
        query: { enrolled: 'true', limit: '100' },
      }),
    ]);

    const parsed = RawProgressList.safeParse(rawProgress);
    if (!parsed.success) {
      return NextResponse.json([], { status: 200 });
    }

    const containerMap = new Map<string, Container>(
      (containersData.items ?? []).map((c) => [c.id, c]),
    );

    const upcoming: LessonPreview[] = parsed.data
      .filter((item) => item.nextItemId && item.nextItemTitle)
      .sort((a, b) => (b.lastAccessedAt ?? '').localeCompare(a.lastAccessedAt ?? ''))
      .slice(0, UPCOMING_LIMIT)
      .flatMap((item) => {
        const container = containerMap.get(item.containerId);
        if (!container) return [];
        return [
          {
            id: item.nextItemId!,
            title: item.nextItemTitle!,
            containerTitle: container.title,
            containerId: item.containerId,
            position: item.completedItems + 1,
            targetLanguage: container.targetLanguage,
            level: container.difficultyLevel,
            isCompleted: false,
          },
        ];
      });

    return NextResponse.json(upcoming);
  } catch (e) {
    if (e instanceof AppError && e.code === 'unauthenticated') {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json({ error: 'Failed to fetch upcoming lessons' }, { status: 502 });
  }
}
