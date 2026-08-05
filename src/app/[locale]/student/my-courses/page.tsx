export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getNextClass } from '@/features/student/api/get-next-class';
import { getStudentSchools } from '@/features/student/api/get-student-schools';
import { NextClassCard } from '@/features/student/home/components';
import { MyCoursesView } from '@/features/student/my-courses/components';
import type { StudentSchool } from '@/features/student/types';

export default async function StudentMyCoursesPage() {
  const t = await getTranslations('Student.myCoursesPage');
  const user = await getCurrentUser();

  // Same next-class composite the Home screen uses — a school-scheduled class
  // is just as relevant while browsing the full course list.
  const schools = user?.userId
    ? await getStudentSchools(user.userId).catch((err) => {
        console.error('[student/my-courses] getStudentSchools failed:', err);
        return [] as StudentSchool[];
      })
    : [];
  const nextClass = user?.userId ? await getNextClass(user.userId, schools) : null;

  return (
    <div className="mx-auto max-w-290 px-4.5 py-5.5 sm:px-8 sm:py-7.5">
      <p className="mb-1.5 text-[11px] font-bold tracking-[0.08em] text-(--ssz-color-primary-500) uppercase">
        {t('eyebrow')}
      </p>
      <h1 className="text-[23px] leading-tight font-bold tracking-[-0.02em] text-(--ssz-text-primary) sm:text-[28px]">
        {t('title')}
      </h1>
      <p className="mt-1.5 max-w-xl text-[14.5px] text-(--ssz-text-secondary)">{t('subtitle')}</p>

      <div className="mt-5">
        <NextClassCard nextClass={nextClass} />
      </div>

      <div className="mt-6">
        <Suspense>
          <MyCoursesView />
        </Suspense>
      </div>
    </div>
  );
}
