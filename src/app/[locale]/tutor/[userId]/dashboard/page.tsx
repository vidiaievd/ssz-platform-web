import { getTranslations, getLocale } from 'next-intl/server';
import { BookOpen, Users, Star } from 'lucide-react';

import { getMyProfile } from '@/features/profile/api/get-my-profile';

export default async function TutorDashboardPage() {
  const [t, locale] = await Promise.all([getTranslations('Tutor'), getLocale()]);

  let profile: Awaited<ReturnType<typeof getMyProfile>> | null = null;
  let profileError = false;
  try {
    profile = await getMyProfile();
  } catch (err) {
    console.error('[tutor/dashboard] getMyProfile failed:', err);
    profileError = true;
  }

  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const firstName = profile?.displayName?.split(' ')[0] ?? null;

  return (
    <div className="px-6 py-8 max-w-page mx-auto space-y-8">

      {/* Greeting */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-(--ssz-text-muted) mb-2">
          {dateLabel}
        </p>
        <h1 className="text-[28px] font-bold tracking-tight text-(--ssz-text-primary) mb-1">
          {firstName
            ? t('dashboard.greetingNamed', { name: firstName })
            : t('dashboard.greeting')}
        </h1>
        <p className="text-sm text-(--ssz-text-secondary)">{t('dashboard.subtitle')}</p>
        {profileError && (
          <p className="mt-1 text-xs text-destructive">Failed to load profile.</p>
        )}
      </div>

      {/* Quick-stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} label={t('dashboard.stats.students')} value="—" />
        <StatCard icon={BookOpen} label={t('dashboard.stats.lessons')} value="—" />
        <StatCard icon={Star} label={t('dashboard.stats.rating')} value="—" />
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlaceholderCard title={t('dashboard.upcoming.title')} body={t('dashboard.upcoming.empty')} />
        <PlaceholderCard title={t('dashboard.students.title')} body={t('dashboard.students.empty')} />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-(--ssz-radius-lg) border border-(--ssz-border-default) bg-surface p-5 flex items-center gap-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-(--ssz-radius-md) bg-(--ssz-bg-subtle)">
        <Icon className="size-5 text-(--ssz-text-secondary)" />
      </div>
      <div>
        <p className="text-2xl font-bold text-(--ssz-text-primary)">{value}</p>
        <p className="text-xs text-(--ssz-text-muted)">{label}</p>
      </div>
    </div>
  );
}

function PlaceholderCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-(--ssz-radius-lg) border border-(--ssz-border-default) bg-surface p-6">
      <h2 className="text-sm font-semibold text-(--ssz-text-primary) mb-3">{title}</h2>
      <p className="text-sm text-(--ssz-text-muted)">{body}</p>
    </div>
  );
}
