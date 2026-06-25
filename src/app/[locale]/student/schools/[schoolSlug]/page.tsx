import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Users } from 'lucide-react';

import { serverFetch } from '@/lib/api/server-fetcher';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getStudentSchool } from '@/features/student/api/get-student-schools';
import { SchoolStatusCard } from '@/features/student/components/school-status-card';
import { GroupHeader } from '@/features/student/components/group-header';
import { WeeklySchedule } from '@/features/student/components/weekly-schedule';
import { GroupMaterials, type MaterialWithLesson } from '@/features/student/components/group-materials';
import type { SchoolMaterial } from '@/features/student/types';
import type { Container, ContainerItem } from '@/features/content/types';

interface Props {
  params: Promise<{ schoolSlug: string }>;
}

async function resolveFirstLessonId(courseId: string): Promise<string | null> {
  try {
    const container = await serverFetch<Container>({ service: 'content', path: `/containers/${courseId}` });
    if (!container.currentPublishedVersionId) return null;

    const items = await serverFetch<ContainerItem[]>({
      service: 'content',
      path: `/containers/${courseId}/versions/${container.currentPublishedVersionId}/items`,
    });
    return items.find((item) => item.itemType === 'lesson')?.itemId ?? null;
  } catch {
    return null;
  }
}

async function withFirstLesson(material: SchoolMaterial): Promise<MaterialWithLesson> {
  return { ...material, firstLessonId: await resolveFirstLessonId(material.courseId) };
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
        <h1 className="sr-only">{t('lockedHeading', { school: school.schoolName })}</h1>
        <SchoolStatusCard school={school} />
      </main>
    );
  }

  const [mainCourse, materials] = await Promise.all([
    school.mainCourse ? withFirstLesson(school.mainCourse) : Promise.resolve(null),
    Promise.all(school.materials.map(withFirstLesson)),
  ]);

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 space-y-8">
      <GroupHeader school={school} />
      <WeeklySchedule schedule={school.schedule} />
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
