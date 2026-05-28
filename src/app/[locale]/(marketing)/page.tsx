import { getTranslations } from 'next-intl/server';
import { GraduationCap, BookOpen, Layers, TrendingUp, Globe } from 'lucide-react';

import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';

export default async function HomePage() {
  const [user, t] = await Promise.all([
    getCurrentUser(),
    getTranslations('Home'),
  ]);

  const dashboardHref = user?.roles.some((r) => r === 'school_admin' || r === 'tutor')
    ? '/school'
    : '/student/dashboard';

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-24 text-center md:pb-28 md:pt-32">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 90% 55% at 50% -5%, oklch(var(--ssz-primary-ch) / 0.10), transparent 70%)',
          }}
        />

        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-(--ssz-text-primary) md:text-5xl lg:text-[3.5rem]">
            {t('heroHeadline')}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-(--ssz-text-secondary) md:text-xl">
            {t('heroSubheadline')}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {user ? (
              <Button variant="primary" size="lg" asChild>
                <Link href={dashboardHref}>{t('ctaDashboard')}</Link>
              </Button>
            ) : (
              <>
                <Button variant="primary" size="lg" asChild>
                  <Link href="/register/student">{t('ctaStudent')}</Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/register?step=org">{t('ctaSchool')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Audience cards */}
      <section className="px-4 pb-20">
        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          {/* Student card */}
          <div className="flex flex-col rounded-2xl border border-border bg-surface p-8 shadow-(--ssz-shadow-sm)">
            <div
              className="mb-4 flex size-11 items-center justify-center rounded-xl"
              style={{ background: 'oklch(var(--ssz-primary-ch) / 0.12)' }}
            >
              <GraduationCap className="size-5" style={{ color: 'oklch(var(--ssz-primary-ch))' }} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              {t('audienceStudentBadge')}
            </span>
            <h2 className="mt-2 text-xl font-bold text-(--ssz-text-primary)">
              {t('audienceStudentTitle')}
            </h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-(--ssz-text-secondary)">
              {t('audienceStudentDesc')}
            </p>
            <div className="mt-6">
              <Button variant="primary" size="sm" asChild>
                <Link href="/register/student">{t('ctaStudent')}</Link>
              </Button>
            </div>
          </div>

          {/* School card */}
          <div className="flex flex-col rounded-2xl border border-border bg-surface p-8 shadow-(--ssz-shadow-sm)">
            <div
              className="mb-4 flex size-11 items-center justify-center rounded-xl"
              style={{ background: 'oklch(var(--ssz-secondary-ch) / 0.12)' }}
            >
              <BookOpen className="size-5" style={{ color: 'oklch(var(--ssz-secondary-ch))' }} />
            </div>
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'oklch(var(--ssz-secondary-ch))' }}
            >
              {t('audienceSchoolBadge')}
            </span>
            <h2 className="mt-2 text-xl font-bold text-(--ssz-text-primary)">
              {t('audienceSchoolTitle')}
            </h2>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-(--ssz-text-secondary)">
              {t('audienceSchoolDesc')}
            </p>
            <div className="mt-6">
              <Button variant="outline" size="sm" asChild>
                <Link href="/register?step=org">{t('ctaSchool')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-subtle px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-2xl font-bold text-(--ssz-text-primary) md:text-3xl">
            {t('featuresTitle')}
          </h2>
          <div className="grid gap-10 md:grid-cols-3">
            {[
              { Icon: Layers, title: t('feature1Title'), desc: t('feature1Desc') },
              { Icon: TrendingUp, title: t('feature2Title'), desc: t('feature2Desc') },
              { Icon: Globe, title: t('feature3Title'), desc: t('feature3Desc') },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="flex flex-col items-start gap-3">
                <div
                  className="flex size-10 items-center justify-center rounded-xl"
                  style={{ background: 'oklch(var(--ssz-primary-ch) / 0.10)' }}
                >
                  <Icon className="size-5" style={{ color: 'oklch(var(--ssz-primary-ch))' }} />
                </div>
                <h3 className="font-semibold text-(--ssz-text-primary)">{title}</h3>
                <p className="text-sm leading-relaxed text-(--ssz-text-secondary)">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
