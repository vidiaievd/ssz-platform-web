import { getLocale, getTranslations } from 'next-intl/server';

import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { ContinueLearning } from '@/features/student/components/continue-learning';
import { StreakStats } from '@/features/student/components/streak-stats';
import { UpcomingLessons } from '@/features/student/components/upcoming-lessons';

export default async function StudentDashboardPage() {
  const [t, locale, profile] = await Promise.all([
    getTranslations('Student'),
    getLocale(),
    getMyProfile().catch((err) => {
      console.error('[student/dashboard] getMyProfile failed:', err);
      return null;
    }),
  ]);

  const firstName = profile?.displayName?.split(' ')[0] ?? null;

  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="px-8 py-8 max-w-275 mx-auto space-y-8">
      {/* Greeting */}
      <div>
        <p className="label-overline mb-2">{dateLabel}</p>
        <h1 className="text-[28px] font-bold tracking-tight text-(--ssz-text-primary) mb-2">
          {firstName
            ? `${t('dashboard.greetingNamed', { name: firstName })} 👋`
            : `${t('dashboard.greeting')} 👋`}
        </h1>
        <p className="text-[15px] text-(--ssz-text-secondary)">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stats grid */}
      <StreakStats />

      {/* Main content: courses + upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <ContinueLearning />
        <UpcomingLessons />
      </div>
    </div>
  );
}
