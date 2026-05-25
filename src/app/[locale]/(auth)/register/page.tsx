import { getTranslations } from 'next-intl/server';
import { GraduationCap, BookOpen, ArrowRight } from 'lucide-react';

import { Link } from '@/lib/i18n/navigation';

export default async function RegisterHubPage() {
  const t = await getTranslations('Auth.RegisterHub');

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="mt-1 text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/register/student"
          className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-all hover:border-primary hover:shadow-(--ssz-shadow-sm)"
        >
          <div
            className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'oklch(var(--ssz-primary-ch) / 0.12)' }}
          >
            <GraduationCap
              className="size-5"
              style={{ color: 'oklch(var(--ssz-primary-ch))' }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-(--ssz-text-primary)">{t('studentTitle')}</p>
            <p className="mt-0.5 text-sm text-(--ssz-text-secondary)">{t('studentDesc')}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors group-hover:gap-2">
              {t('studentCta')}
              <ArrowRight className="size-3.5" />
            </span>
          </div>
        </Link>

        <Link
          href="/register/school"
          className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-all hover:border-(--ssz-border-strong) hover:shadow-(--ssz-shadow-sm)"
        >
          <div
            className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'oklch(var(--ssz-secondary-ch) / 0.12)' }}
          >
            <BookOpen
              className="size-5"
              style={{ color: 'oklch(var(--ssz-secondary-ch))' }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-(--ssz-text-primary)">{t('schoolTitle')}</p>
            <p className="mt-0.5 text-sm text-(--ssz-text-secondary)">{t('schoolDesc')}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-(--ssz-text-secondary) transition-colors group-hover:gap-2 group-hover:text-(--ssz-text-primary)">
              {t('schoolCta')}
              <ArrowRight className="size-3.5" />
            </span>
          </div>
        </Link>
      </div>

      <p className="text-center text-sm text-(--ssz-text-muted)">
        {t('hasAccount')}{' '}
        <Link href="/login" className="text-(--ssz-text-link) hover:underline">
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
