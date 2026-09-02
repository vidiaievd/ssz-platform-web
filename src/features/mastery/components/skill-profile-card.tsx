import { Target } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { cn } from '@/lib/utils';

import { getMasteryProfile } from '../api/get-mastery-profile';
import { splitVerdicts } from '../lib/split-verdicts';
import type { MasteryCell, MasteryUncertainCell, MasteryVerdict } from '../types';

type Translate = Awaited<ReturnType<typeof getTranslations<'Mastery'>>>;

/** `skill · focus`, both sides named — an unrecorded axis is a finding, not a blank (§3.10). */
function label(cell: MasteryCell, t: Translate): string {
  return t('cell', {
    skill: t(`skill.${cell.skill}` as 'skill.listening'),
    focus: t(`focus.${cell.focus}` as 'focus.vocabulary'),
  });
}

function Block({
  heading,
  empty,
  children,
  count,
}: {
  heading: string;
  empty: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {heading}
      </h3>
      {count === 0 ? (
        <p className="text-sm text-(--ssz-text-secondary)">{empty}</p>
      ) : (
        <ul className="space-y-1">{children}</ul>
      )}
    </section>
  );
}

function Row({ name, meta, tone }: { name: string; meta: string; tone: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 text-sm">
      <span className="flex min-w-0 items-baseline gap-2">
        <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', tone)} aria-hidden />
        <span className="truncate text-(--ssz-text-primary)">{name}</span>
      </span>
      <span className="shrink-0 text-xs text-(--ssz-text-secondary)">{meta}</span>
    </li>
  );
}

function VerdictRow({ verdict, tone, t }: { verdict: MasteryVerdict; tone: string; t: Translate }) {
  return (
    <Row
      name={label(verdict, t)}
      tone={tone}
      meta={`${t('teacher.successRate', {
        percent: Math.round(verdict.successRateEwma * 100),
      })} · ${t('teacher.attempts', { count: verdict.attempts })}`}
    />
  );
}

type Props = {
  /** The learner this profile is about — an auth user id, not a school membership id. */
  userId: string;
  /** Narrow to one course. Omitted means everything the learner has ever practised. */
  courseId?: string;
};

/**
 * What practice says about one learner — plan 55 §6.1.
 *
 * Three blocks rather than one scale, because the three answers are different in kind:
 * what is working, what is not, and what nobody has measured. Rolling them together
 * would let a cell with nine attempts and one with none share a column, and the third
 * block is usually the useful one today — a cell with no evidence normally means the
 * course contains none of that, which is the coverage report's finding arriving from
 * the learner's side (§3.10).
 *
 * A server component: it reads an `/internal/*` route that the gateway does not expose,
 * and the page above it has already established that this teacher may look at this
 * learner. Nothing here is interactive, so none of it needs to reach the browser.
 */
export async function SkillProfileCard({ userId, courseId }: Props) {
  const t = await getTranslations('Mastery');
  const profile = await getMasteryProfile(userId, courseId ? { courseId } : {});

  const heading = (
    <div className="flex items-center gap-2">
      <Target className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <h2 className="text-sm font-semibold text-(--ssz-text-primary)">{t('teacher.title')}</h2>
    </div>
  );

  // "We could not ask" is not "there is nothing to say": an empty profile is a claim
  // about the learner, and a failed call must not be allowed to make it.
  if (!profile) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-5">
        {heading}
        <p className="text-sm text-(--ssz-text-secondary)">{t('teacher.unavailable')}</p>
      </div>
    );
  }

  const { strong, weak } = splitVerdicts(profile.weakest);
  const uncertain: MasteryUncertainCell[] = profile.insufficient;

  const hasUnrecordedAxis = [...profile.weakest, ...uncertain].some(
    (cell) => cell.skill === 'unknown' || cell.focus === 'unknown',
  );

  if (strong.length === 0 && weak.length === 0 && uncertain.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-5">
        {heading}
        <p className="text-sm text-(--ssz-text-secondary)">{t('teacher.empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      {heading}

      <Block heading={t('teacher.weakHeading')} empty={t('teacher.weakEmpty')} count={weak.length}>
        {weak.map((verdict) => (
          <VerdictRow
            key={`${verdict.skill}-${verdict.focus}`}
            verdict={verdict}
            tone="bg-[var(--ssz-color-error-600)]"
            t={t}
          />
        ))}
      </Block>

      <Block
        heading={t('teacher.strongHeading')}
        empty={t('teacher.strongEmpty')}
        count={strong.length}
      >
        {strong.map((verdict) => (
          <VerdictRow
            key={`${verdict.skill}-${verdict.focus}`}
            verdict={verdict}
            tone="bg-[var(--ssz-color-success-600)]"
            t={t}
          />
        ))}
      </Block>

      <Block
        heading={t('teacher.uncertainHeading')}
        empty={t('teacher.uncertainEmpty')}
        count={uncertain.length}
      >
        {uncertain.map((cell) => (
          <Row
            key={`${cell.skill}-${cell.focus}`}
            name={label(cell, t)}
            tone="bg-muted-foreground/40"
            // Attempts, never a success rate: below the bar there is no verdict, and a
            // percentage printed next to a cell is read as one however it is captioned.
            meta={t('teacher.attempts', { count: cell.attempts })}
          />
        ))}
      </Block>

      {/* The footnotes are printed only where they explain something on screen: the bar
          when a cell is being held back by it, and the unrecorded axis when one is shown. */}
      {uncertain.length > 0 && (
        <p className="text-xs text-(--ssz-text-secondary)">
          {t('teacher.uncertainHint', { count: profile.minWeightedSample })}
        </p>
      )}
      {hasUnrecordedAxis && (
        <p className="text-xs text-(--ssz-text-secondary)">{t('teacher.unknownNote')}</p>
      )}
    </div>
  );
}
