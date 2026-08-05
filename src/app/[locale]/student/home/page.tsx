export const dynamic = 'force-dynamic';

import { getLocale } from 'next-intl/server';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { getNextClass } from '@/features/student/api/get-next-class';
import { getStudentSchools } from '@/features/student/api/get-student-schools';
import {
  ExploreCoursesCta,
  GroupAccessNotice,
  HomeGreeting,
  MyCoursesPreview,
  NextClassCard,
  QuickTraining,
  ResumePanel,
  ReviewsDueCard,
  StudyRhythmPanel,
} from '@/features/student/home/components';
import type { StudentSchool } from '@/features/student/types';

export default async function StudentHomePage() {
  const [locale, user, profile] = await Promise.all([
    getLocale(),
    getCurrentUser(),
    getMyProfile().catch((err) => {
      console.error('[student/home] getMyProfile failed:', err);
      return null;
    }),
  ]);

  // The school aggregate feeds both the next-class card and the group-access
  // notice, so it is fetched once here and handed to both.
  const schools = user?.userId
    ? await getStudentSchools(user.userId).catch((err) => {
        console.error('[student/home] getStudentSchools failed:', err);
        return [] as StudentSchool[];
      })
    : [];
  const nextClass = user?.userId ? await getNextClass(user.userId, schools) : null;

  const firstName = profile?.displayName?.split(' ')[0] ?? null;
  const today = new Date();
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(today);

  const hasClassToday = nextClass?.date === today.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-290 px-4.5 py-5.5 sm:px-8 sm:py-7.5">
      <HomeGreeting dateLabel={dateLabel} firstName={firstName} hasClassToday={hasClassToday} />

      <div className="mt-5">
        <GroupAccessNotice schools={schools} />
      </div>

      {/* Top: the single most useful next action, flanked by what's time-bound. */}
      <div className="mt-5 grid items-start gap-4.5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ResumePanel />
        <div className="flex flex-col gap-3.5">
          <NextClassCard nextClass={nextClass} />
          <ReviewsDueCard />
        </div>
      </div>

      <div className="mt-8.5">
        <QuickTraining />
      </div>

      {/* Bottom: the calmer, browse-y half of the screen. */}
      <div className="mt-8.5 grid items-start gap-6.5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <MyCoursesPreview />
        <div className="flex flex-col gap-3.5">
          <StudyRhythmPanel />
          <ExploreCoursesCta />
        </div>
      </div>
    </div>
  );
}
