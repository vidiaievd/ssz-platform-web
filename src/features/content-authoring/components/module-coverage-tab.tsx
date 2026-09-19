'use client';

import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/lib/i18n/navigation';

import { useContainerCoverage } from '../api/use-container-coverage';
import { CoverageStrip } from './coverage-strip';

interface ModuleCoverageTabProps {
  /** The module being inspected. A module is a container, so it is counted on its own terms. */
  containerId: string;
}

/**
 * What the selected module trains, inside the inspector.
 *
 * A module rather than the course, because a course balanced in aggregate can
 * still hold a module that is nothing but reading — and the module is what the
 * author has open. It is a tab rather than a block at the foot of the form
 * because the form is long and the numbers were being scrolled past.
 *
 * The unit is spelt out. Every count on the Coverage tab answers a different
 * question in a different unit, and the one mistake that makes the whole report
 * useless is adding two of them together.
 */
export function ModuleCoverageTab({ containerId }: ModuleCoverageTabProps) {
  const t = useTranslations('Authoring');
  const pathname = usePathname();
  const { data } = useContainerCoverage(containerId);
  const total = data?.draft?.coverage.total ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[13px] font-bold text-foreground">
            {t('structure.moduleCoverageTitle')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t('structure.moduleCoverageSubtitle', { count: total })}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('units.exercises')}
        </span>
      </div>

      <CoverageStrip containerId={containerId} compact hideHeading />

      {/* The module's numbers, then the course's: the strip above cannot say
          what the course is missing as a whole, and the author should not have
          to click every module to find out. */}
      <Link
        href={`${pathname}?view=coverage`}
        className="text-xs font-semibold text-primary hover:underline"
      >
        {t('structure.openFullReport')}
      </Link>
    </div>
  );
}
