import { getTranslations } from 'next-intl/server';

import { ContinueLearning } from '@/features/student/components/continue-learning';
import { StreakWidget } from '@/features/student/components/streak-widget';
import { UpcomingLessons } from '@/features/student/components/upcoming-lessons';
import { VoxOrdPromo } from '@/features/student/components/voxord-promo';
import { getMyProfile } from '@/features/profile/api/get-my-profile';

export default async function EnrolledPage() {
  const [t, profile] = await Promise.all([
    getTranslations('Student'),
    getMyProfile().catch(() => null),
  ]);

  const firstName = profile?.displayName?.split(' ')[0] ?? null;

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">
          {firstName ? t('dashboard.greetingNamed', { name: firstName }) : t('dashboard.greeting')}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('dashboard.subtitle')}</p>
      </div>

      <div className="space-y-10">
        <VoxOrdPromo />

        <ContinueLearning />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <UpcomingLessons />
          </div>
          <div>
            <StreakWidget />
          </div>
        </div>
      </div>
    </main>
  );
}
