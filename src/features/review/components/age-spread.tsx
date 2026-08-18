'use client';

import { useTranslations } from 'next-intl';

import { ageTone } from '../lib/age-scale';
import { useAgeWords } from './age-mark';

export interface AgeSpreadProps {
  /** One entry per waiting submission, in hours. Order does not matter — it is sorted. */
  hours: readonly number[];
  /** The promise these ages are coloured against. */
  slaHours: number;
  height?: number;
  className?: string;
}

/**
 * The shape of a queue: one bar per submission, youngest to oldest, coloured by age.
 *
 * This is the component that answers "everything is overdue". A count says 34 and stops;
 * two queues of 34 with different tails are the difference between a teacher who is behind
 * and a teacher who has abandoned something, and only the distribution shows it. It is why
 * the queue endpoint returns every submission time rather than a min and a mean — the
 * histogram cannot be rebuilt from an aggregate.
 *
 * An empty queue renders nothing at all rather than an empty frame: a group with no
 * submissions does not appear, and a zero-width strip in oversight would read as a
 * rendering fault.
 */
export function AgeSpread({ hours, slaHours, height = 10, className }: AgeSpreadProps) {
  const t = useTranslations('Review.age');
  const { words } = useAgeWords();

  if (hours.length === 0) return null;

  const sorted = [...hours].sort((a, b) => a - b);
  const oldest = sorted[sorted.length - 1] ?? 0;

  return (
    <span
      className={`flex items-stretch gap-[1.5px] ${className ?? ''}`}
      style={{ height }}
      role="img"
      aria-label={t('spread', { n: sorted.length, oldest: words(oldest) })}
    >
      {sorted.map((age, index) => (
        <span
          // Ages repeat and carry no identity; position in a sorted list is the only key
          // there is, and the list is rebuilt whole on every change anyway.
          key={index}
          className="min-w-[2px] flex-1 rounded-[2px]"
          style={{ background: ageTone(age, slaHours) }}
        />
      ))}
    </span>
  );
}
