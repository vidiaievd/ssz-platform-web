import { notFound } from 'next/navigation';

import { serverFetch } from '@/lib/api/server-fetcher';
import { AppError } from '@/lib/errors';
import { LessonPlayer } from '@/features/student/components/lesson-player';
import type { Container, ContainerItem, Lesson, LessonVariant } from '@/features/content/types';

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ containerId?: string }>;
}

export default async function LessonPage({ params, searchParams }: Props) {
  const [{ id }, { containerId }] = await Promise.all([params, searchParams]);

  let lesson: Lesson;
  let variant: LessonVariant | null = null;

  try {
    [lesson, variant] = await Promise.all([
      serverFetch<Lesson>({ service: 'content', path: `/lessons/${id}` }),
      serverFetch<LessonVariant>({
        service: 'content',
        path: `/lessons/${id}/variants/best`,
      }).catch((err) => {
        console.error('[lessons/id] lesson variant fetch failed:', err);
        return null;
      }),
    ]);
  } catch (e) {
    if (e instanceof AppError && e.code === 'not_found') notFound();
    throw e;
  }

  // Resolve container navigation context when containerId is provided.
  let prevId: string | undefined;
  let nextId: string | undefined;
  let position: number | undefined;
  let total: number | undefined;
  let containerTitle: string | undefined;

  if (containerId) {
    try {
      const container = await serverFetch<Container>({
        service: 'content',
        path: `/containers/${containerId}`,
      });
      containerTitle = container.title;

      if (container.currentPublishedVersionId) {
        const items = await serverFetch<ContainerItem[]>({
          service: 'content',
          path: `/containers/${containerId}/versions/${container.currentPublishedVersionId}/items`,
        });

        const lessonItems = items.filter((item) => item.contentType === 'LESSON');
        const idx = lessonItems.findIndex((item) => item.contentId === id);

        if (idx !== -1) {
          position = idx + 1;
          total = lessonItems.length;
          prevId = idx > 0 ? lessonItems[idx - 1]!.contentId : undefined;
          nextId = idx < lessonItems.length - 1 ? lessonItems[idx + 1]!.contentId : undefined;
        }
      }
    } catch {
      // Container unavailable — render player without nav context.
    }
  }

  return (
    <LessonPlayer
      lesson={lesson}
      variant={variant}
      prevId={prevId}
      nextId={nextId}
      position={position}
      total={total}
      containerTitle={containerTitle}
      containerId={containerId}
    />
  );
}
