'use client';

import { useTranslations } from 'next-intl';

import { ageRail, ageTextTone, ageTone, isOverdue } from '../lib/age-scale';

/**
 * Age in words for a number of hours, against the `Review.age.*` keys.
 *
 * A duration, not a relative time: the screen says "4 days", because what a teacher is
 * judging is how long a learner has been waiting, and "4 days ago" invites reading the
 * submission time instead of the wait. Hours below a day, days above it — an exact hour
 * count on a five-day wait is precision nobody spends.
 */
export function useAgeWords() {
  const t = useTranslations('Review.age');

  return {
    /** «2 ч» / «4 дня» — always rendered beside the rail, never instead of it. */
    words(hours: number): string {
      if (hours < 1) return t('justNow');
      if (hours < 24) return t('hours', { n: Math.round(hours) });
      return t('days', { n: Math.floor(hours / 24) });
    },
    /** «просрочено на 6 ч», or null while the promise still holds. */
    overdueWords(hours: number, slaHours: number): string | null {
      if (!isOverdue(hours, slaHours)) return null;
      const over = hours - slaHours;
      return over < 24
        ? t('overdueBy.hours', { n: Math.round(over) })
        : t('overdueBy.days', { n: Math.floor(over / 24) });
    },
  };
}

export interface AgeMarkProps {
  /** How long this submission has been waiting. */
  hours: number;
  /** The promise it is waiting against — the school's, or the course's override. */
  slaHours: number;
  /** Off where the row is too narrow to carry "N hours past" as well. */
  showOverdue?: boolean;
  className?: string;
}

/**
 * The atomic unit of urgency: a coloured rail and the age in words beside it.
 *
 * The two are one component precisely so they cannot come apart. Colour alone fails a
 * reader who does not see it and a list where everything is late; the words alone lose the
 * comparison between rows that makes a queue scannable. Everywhere urgency appears — the
 * inbox row, the submission header, the stuck list in oversight — it appears as both.
 */
export function AgeMark({ hours, slaHours, showOverdue = true, className }: AgeMarkProps) {
  const { words, overdueWords } = useAgeWords();
  const tone = ageTone(hours, slaHours);
  const textTone = ageTextTone(hours, slaHours);
  const past = overdueWords(hours, slaHours);

  return (
    // No label on the wrapper: the words below are real text, and a reader that met both
    // an `aria-label` and the same words inside it would hear the age twice.
    <span className={`inline-flex min-w-0 items-center gap-2 ${className ?? ''}`}>
      <span
        aria-hidden
        className="shrink-0 rounded-full"
        style={{ width: ageRail(hours, slaHours), height: 22, background: tone }}
      />
      <span
        className={`whitespace-nowrap text-xs font-semibold ${past === null ? '' : 'ssz-age-text'}`}
        style={
          past === null
            ? { color: 'var(--ssz-text-secondary)' }
            : ({
                '--age-text-light': textTone.light,
                '--age-text-dark': textTone.dark,
              } as React.CSSProperties)
        }
      >
        {words(hours)}
        {showOverdue && past !== null ? <span className="font-medium">{` · ${past}`}</span> : null}
      </span>
    </span>
  );
}
