'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { GraduationCap, BookOpen, Building2, UserCheck, ArrowRight, ArrowLeft } from 'lucide-react';

import { Link } from '@/lib/i18n/navigation';

type Step = 'hub' | 'org';

export default function RegisterHubPage() {
  const t = useTranslations('Auth.RegisterHub');
  const tOrg = useTranslations('Auth.RegisterOrg');
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(searchParams.get('step') === 'org' ? 'org' : 'hub');

  if (step === 'org') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <button
            onClick={() => setStep('hub')}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-(--ssz-text-muted) hover:text-(--ssz-text-primary) transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            {t('back')}
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-(--ssz-text-primary)">{tOrg('title')}</h1>
            <p className="mt-1 text-sm text-(--ssz-text-muted)">{tOrg('subtitle')}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/register/school"
            className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-all hover:border-(--ssz-border-strong) hover:shadow-(--ssz-shadow-sm)"
          >
            <div
              className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'oklch(var(--ssz-secondary-ch) / 0.12)' }}
            >
              <Building2
                className="size-5"
                style={{ color: 'oklch(var(--ssz-secondary-ch))' }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-(--ssz-text-primary)">{tOrg('schoolTitle')}</p>
              <p className="mt-0.5 text-sm text-(--ssz-text-secondary)">{tOrg('schoolDesc')}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-(--ssz-text-secondary) transition-colors group-hover:gap-2 group-hover:text-(--ssz-text-primary)">
                {tOrg('schoolCta')}
                <ArrowRight className="size-3.5" />
              </span>
            </div>
          </Link>

          <Link
            href="/register/tutor"
            className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-all hover:border-(--ssz-border-strong) hover:shadow-(--ssz-shadow-sm)"
          >
            <div
              className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'oklch(var(--ssz-tutor-ch) / 0.12)' }}
            >
              <UserCheck
                className="size-5"
                style={{ color: 'oklch(var(--ssz-tutor-ch))' }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-(--ssz-text-primary)">{tOrg('tutorTitle')}</p>
              <p className="mt-0.5 text-sm text-(--ssz-text-secondary)">{tOrg('tutorDesc')}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-(--ssz-text-secondary) transition-colors group-hover:gap-2 group-hover:text-(--ssz-text-primary)">
                {tOrg('tutorCta')}
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

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="mt-1 text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/register/student"
          className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-all hover:border-(--ssz-border-strong) hover:shadow-(--ssz-shadow-sm)"
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
            <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-(--ssz-text-secondary) transition-colors group-hover:gap-2 group-hover:text-(--ssz-text-primary)">
              {t('studentCta')}
              <ArrowRight className="size-3.5" />
            </span>
          </div>
        </Link>

        <button
          onClick={() => setStep('org')}
          className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-5 text-left transition-all hover:border-(--ssz-border-strong) hover:shadow-(--ssz-shadow-sm)"
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
        </button>
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
