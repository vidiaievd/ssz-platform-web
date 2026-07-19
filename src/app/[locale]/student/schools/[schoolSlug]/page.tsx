import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Users } from 'lucide-react';

import { RouteHeading } from '@/components/shared/route-heading';
import { serverFetch } from '@/lib/api/server-fetcher';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getStudentSchool } from '@/features/student/api/get-student-schools';
import { getAssignedMaterials } from '@/features/student/api/get-assigned-materials';
import { SchoolStatusCard } from '@/features/student/components/school-status-card';
import { GroupHeader } from '@/features/student/components/group-header';
import { WeeklySchedule } from '@/features/student/components/weekly-schedule';
import { GroupMaterials, type CourseMaterialLink } from '@/features/student/components/group-materials';
import { AssignedMaterials } from '@/features/student/components/assigned-materials';
import type { LessonProgressStatus, SchoolMaterial } from '@/features/student/types';
import type { Container } from '@/features/content/types';

interface Props {
  params: Promise<{ schoolSlug: string }>;
}

/** Course-level progress rollup from learning-service (see course-home BFF route). */
interface RawCourseProgress {
  completedItems: number;
  totalItems: number;
}

/**
 * A course is openable once it has a published version; its coarse status comes
 * from the course-level progress rollup. Both the material list and the course
 * reader link key off the courseId — no per-lesson resolution needed (the
 * reader handles unit/lesson navigation itself).
 */
async function resolveMaterialLink(material: SchoolMaterial): Promise<CourseMaterialLink> {
  try {
    const container = await serverFetch<Container>({
      service: 'content',
      path: `/containers/${material.courseId}`,
    });
    if (!container.currentPublishedVersionId) {
      return { ...material, isAvailable: false, progressStatus: null };
    }

    let progressStatus: LessonProgressStatus | null = null;
    try {
      const progress = await serverFetch<RawCourseProgress>({
        service: 'progress',
        path: `/progress/course/${material.courseId}`,
      });
      if (progress.totalItems > 0) {
        progressStatus =
          progress.completedItems >= progress.totalItems
            ? 'completed'
            : progress.completedItems > 0
              ? 'in_progress'
              : 'not_started';
      }
    } catch {
      // Progress is a nice-to-have badge; availability doesn't depend on it.
    }

    return { ...material, isAvailable: true, progressStatus };
  } catch {
    return { ...material, isAvailable: false, progressStatus: null };
  }
}

export default async function SchoolDetailPage({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations('Student.SchoolDetail');

  const user = await getCurrentUser();
  if (!user?.userId) notFound();

  const school = await getStudentSchool(user.userId, schoolSlug);
  if (!school) notFound();

  if (school.status !== 'active') {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <RouteHeading className="sr-only">{t('lockedHeading', { school: school.schoolName })}</RouteHeading>
        <SchoolStatusCard school={school} />
      </main>
    );
  }

  const [assignedMaterials, mainCourse, materials] = await Promise.all([
    getAssignedMaterials(school.schoolId),
    school.mainCourse ? resolveMaterialLink(school.mainCourse) : Promise.resolve(null),
    Promise.all(school.materials.map((m) => resolveMaterialLink(m))),
  ]);

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
      <GroupHeader school={school} />
      <WeeklySchedule schedule={school.schedule} />
      <AssignedMaterials assignments={assignedMaterials} />
      <GroupMaterials mainCourse={mainCourse} materials={materials} />
      {school.classmateCount != null && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('classmates', { count: school.classmateCount })}
        </p>
      )}
    </main>
  );
}
