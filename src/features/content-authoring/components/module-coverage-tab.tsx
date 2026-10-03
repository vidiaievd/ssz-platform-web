'use client';

import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/lib/i18n/navigation';

import { useContainerCoverage } from '../api/use-container-coverage';
import { CoverageStrip } from './coverage-strip';

interface ModuleCoverageTabProps {
  /** The module being inspected. A module is a container, so it is counted on its own terms. */
  containerId: string;
  /** Which sentence to say: the same card reads for a module and for the whole course. */
  scope?: 'module' | 'course';
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
export function ModuleCoverageTab({ containerId, scope = 'module' }: ModuleCoverageTabProps) {
  const t = useTranslations('Authoring');
  const pathname = usePathname();
  const { data } = useContainerCoverage(containerId);
  const total = data?.draft?.coverage.total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span className="h-0.5 w-3 bg-primary" aria-hidden />
          {t('units.exercises')}
        </span>
        <h3 className="text-lg font-bold leading-tight text-foreground">
          {t(
            scope === 'course' ? 'structure.courseCoverageTitle' : 'structure.moduleCoverageTitle',
          )}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t(
            scope === 'course'
              ? 'structure.courseCoverageSubtitle'
              : 'structure.moduleCoverageSubtitle',
            { count: total },
          )}
        </p>
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
