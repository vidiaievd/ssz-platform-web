import type { ContainerPublishState, CurriculumTree } from '@/features/content/types';

export interface PublishRow {
  containerId: string;
  title: string;
  kind: 'course' | 'module';
  publishState: ContainerPublishState;
}

/**
 * Everything in this course that students cannot see yet: the course version
 * plus every module whose draft is ahead of its published one.
 *
 * Modules come first — each is published in its own right, and a course
 * version that goes live before them would point at modules students still
 * cannot open.
 */
export function collectPublishRows(
  tree: CurriculumTree | undefined,
  courseTitle: string,
): PublishRow[] {
  if (!tree) return [];
  const modules = tree.levels
    .flatMap((level) => level.modules)
    .filter((m) => m.publishState !== 'published')
    .map<PublishRow>((m) => ({
      containerId: m.containerId,
      title: m.title ?? '',
      kind: 'module',
      publishState: m.publishState,
    }));

  const course: PublishRow[] =
    tree.publishState === 'published'
      ? []
      : [
          {
            containerId: tree.containerId,
            title: courseTitle,
            kind: 'course',
            publishState: tree.publishState,
          },
        ];

  return [...modules, ...course];
}
