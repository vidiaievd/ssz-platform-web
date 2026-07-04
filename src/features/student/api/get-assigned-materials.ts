import 'server-only';

import { z } from 'zod';

import { serverFetch } from '@/lib/api/server-fetcher';
import type { Container, GrammarRule, Lesson, VocabularyList } from '@/features/content/types';
import type { AssignedMaterial, AssignmentContentType, AssignmentStatusLower } from '../types/learning';

const STATUS_MAP: Record<string, AssignmentStatusLower> = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  OVERDUE: 'overdue',
};

const AssignmentItem = z.object({
  id: z.string(),
  schoolId: z.string().nullable(),
  contentRef: z.object({ type: z.string(), id: z.string() }),
  status: z.string(),
  dueAt: z.string(),
  notes: z.string().nullable().optional(),
});

const AssignmentList = z.array(AssignmentItem);

/** Resolves a display title and a student-facing href (when one exists) for a content ref. */
async function hydrate(
  contentType: AssignmentContentType,
  contentId: string,
): Promise<{ title: string; href: string | null }> {
  try {
    switch (contentType) {
      case 'LESSON': {
        const lesson = await serverFetch<Lesson>({ service: 'content', path: `/lessons/${contentId}` });
        return { title: lesson.title, href: `/student/enrolled/lessons/${contentId}` };
      }
      case 'CONTAINER': {
        const container = await serverFetch<Container>({ service: 'content', path: `/containers/${contentId}` });
        return { title: container.title, href: null };
      }
      case 'VOCABULARY_LIST': {
        const list = await serverFetch<VocabularyList>({
          service: 'content',
          path: `/vocabulary-lists/${contentId}`,
        });
        return { title: list.title, href: null };
      }
      case 'GRAMMAR_RULE': {
        const rule = await serverFetch<GrammarRule>({ service: 'content', path: `/grammar-rules/${contentId}` });
        return { title: rule.title, href: null };
      }
      case 'EXERCISE':
        // No student-facing exercise page exists yet (see student exercise wiring phase).
        return { title: '', href: null };
    }
  } catch {
    return { title: '', href: null };
  }
}

/**
 * Fetches assignments explicitly given to the current student (with a due date),
 * scoped to active/overdue ones, and hydrates each with a display title from
 * content-service. Distinct from group curriculum, which has no due dates.
 */
export async function getAssignedMaterials(schoolId?: string): Promise<AssignedMaterial[]> {
  try {
    // serverFetch doesn't support repeated query keys (status=ACTIVE&status=OVERDUE),
    // so the active/overdue filter is applied client-side instead.
    const raw = await serverFetch({ service: 'progress', path: '/assignments/mine' });

    const parsed = AssignmentList.safeParse(raw);
    if (!parsed.success) return [];

    const actionable = parsed.data.filter((a) => a.status === 'ACTIVE' || a.status === 'OVERDUE');
    const scoped = schoolId ? actionable.filter((a) => a.schoolId === schoolId) : actionable;

    const hydrated = await Promise.all(
      scoped.map(async (a) => {
        const contentType = a.contentRef.type as AssignmentContentType;
        const { title, href } = await hydrate(contentType, a.contentRef.id);
        return {
          assignmentId: a.id,
          contentType,
          contentId: a.contentRef.id,
          title,
          status: STATUS_MAP[a.status] ?? 'active',
          dueAt: a.dueAt,
          notes: a.notes ?? null,
          href,
        };
      }),
    );

    return hydrated.filter((m) => m.title);
  } catch {
    return [];
  }
}
