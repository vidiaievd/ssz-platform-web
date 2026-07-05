'use client';

import { Compass } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';
import { showFindSchoolEntry } from '@/lib/enrollment/discover-visibility';
import { useStudentSchools } from '../api/use-student-schools';

export function FindSchoolBand() {
  const t = useTranslations('Discovery');
  const { data: schools, isLoading } = useStudentSchools();

  if (isLoading || !schools) return null;
  if (!showFindSchoolEntry(schools)) return null;

  return (
    <section
      className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card px-6 py-8 sm:flex-row sm:items-center sm:justify-between"
      aria-labelledby="find-school-heading"
    >
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent">
          <Compass className="size-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <div>
          <h2 id="find-school-heading" className="text-base font-semibold text-(--ssz-text-primary)">
            {t('findSchool.title')}
          </h2>
          <p className="mt-1 text-sm text-(--ssz-text-secondary)">{t('findSchool.subtitle')}</p>
        </div>
      </div>

      <Button asChild variant="primary" className="shrink-0">
        <Link href="/discover">{t('findSchool.cta')}</Link>
      </Button>
    </section>
  );
}
