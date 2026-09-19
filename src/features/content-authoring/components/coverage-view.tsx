'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { useAtomCoverage } from '../api/use-atom-coverage';
import { useContainerCoverage } from '../api/use-container-coverage';
import { AtomCoverageReport } from './atom-coverage-report';
import { CoverageResultGrid } from './coverage-result-grid';
import { CoverageStrip } from './coverage-strip';
import { CoverageTriage } from './coverage-triage';

interface CoverageViewProps {
  containerId: string;
  containerType: string;
  /** Version students currently see; null while the container has never been published. */
  publishedVersionNumber: number | null;
}

/** The unit a card counts in, said out loud in its header. */
function UnitLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

function Card({
  unit,
  className,
  children,
}: {
  unit: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <div className="mb-2 flex justify-end">
        <UnitLabel>{unit}</UnitLabel>
      </div>
      {children}
    </div>
  );
}

/**
 * The coverage report, in the order an author can act on it: what to fix, what
 * the draft is, and what came of the version students already have.
 *
 * Three cards answering three questions in three different units — exercises,
 * facts, results — and the one mistake that makes the whole report useless is
 * adding two of them together. Hence the unit on every card: it is a guard
 * rail, not a caption (COVERAGE.md §1).
 *
 * The published zone is set apart rather than mixed in because it answers about
 * a different version of the course: the draft is what the author is editing,
 * and what students are working through today may be weeks behind it.
 */
export function CoverageView({
  containerId,
  containerType,
  publishedVersionNumber,
}: CoverageViewProps) {
  const t = useTranslations('Authoring');
  const { data: coverage } = useContainerCoverage(containerId);
  const { data: atoms } = useAtomCoverage(containerId);

  const exercises = coverage?.draft?.coverage.total ?? 0;
  const facts = atoms?.summary.introduced ?? 0;

  return (
    <div className="space-y-6">
      {/* What to do about this course, before anything about what it is. */}
      <CoverageTriage containerId={containerId} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-[13px] font-bold text-foreground">{t('zones.draft')}</h2>
          <p className="text-xs text-muted-foreground">
            {publishedVersionNumber == null
              ? t('zones.draftNeverPublished', { exercises, facts })
              : t('zones.draftAgainstVersion', {
                  version: publishedVersionNumber,
                  exercises,
                  facts,
                })}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* What the course is made of, by the exercises it holds. Drawn
              expanded rather than folded behind a toggle — a channel nothing
              trains is invisible in a panel nobody opens. */}
          <Card unit={t('units.exercises')} className="scroll-mt-[var(--structure-sticky-top)]">
            <div id="coverage-skills">
              <CoverageStrip containerId={containerId} />
            </div>
          </Card>

          {/* The same question asked of the facts rather than of the exercises: the strip
              beside it says this course is 84% picking an answer off a list, and this says
              which twenty-six words that leaves untested. Beside it rather than inside it —
              one counts exercises and the other counts what they are about, and a reader
              who cannot tell which is which will trust neither. */}
          <Card unit={t('units.facts')} className="scroll-mt-[var(--structure-sticky-top)]">
            <div id="coverage-atoms">
              <AtomCoverageReport containerId={containerId} />
            </div>
          </Card>
        </div>
      </section>

      {/* And underneath it, the same course seen from the other end: what came of
          teaching it. A course, not a module — a module's results are the course's
          results sliced too thin to read, and the published version is what learners
          actually took. */}
      {containerType === 'course' && (
        <section className="space-y-3 rounded-xl bg-muted/40 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div>
              <h2 className="text-[13px] font-bold text-foreground">{t('zones.students')}</h2>
              <p className="text-xs text-muted-foreground">{t('zones.studentsHint')}</p>
            </div>
            <UnitLabel>{t('units.results')}</UnitLabel>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <CoverageResultGrid containerId={containerId} />
          </div>
        </section>
      )}
    </div>
  );
}
