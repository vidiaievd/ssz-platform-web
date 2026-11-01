'use client';

import { useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { Card, CardBody } from '@/components/ui/card';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';

import type { WeakRule, WeakRules, WeakRulesWindow } from '../types';
import { Note } from './note';

export interface WeakRulesPanelProps {
  /** BFF route that answers `WeakRules`; the window is appended as `?window=`. */
  endpoint: string;
  /** A group counts learners per rule; for a single learner that column is always 1. */
  showLearners?: boolean;
}

/**
 * Grammar rules the checks of this work named as the ground of a mistake (platform plan 85,
 * step 11). Own query, own failure: the panel beside it must not go down with it.
 *
 * An empty list is «no signal», never «no weak rules» — the checks only see what was handed
 * in or rehearsed, so the note says what the list is made of.
 */
export function WeakRulesPanel({ endpoint, showLearners = false }: WeakRulesPanelProps) {
  const t = useTranslations('Analytics.weakRules');
  const [window, setWindow] = useState<WeakRulesWindow>('30');
  const { data, isPending, isError } = useQuery<WeakRules>({
    queryKey: ['weak-rules', endpoint, window],
    queryFn: async () => {
      const res = await fetch(`${endpoint}?window=${window}`);
      if (!res.ok) throw new Error('Failed to fetch weak rules');
      const body = (await res.json()) as WeakRules;
      // A body of another shape is a failure to read, not a list with nothing in it.
      if (!Array.isArray(body?.rules)) throw new Error('Unexpected weak rules answer');
      return body;
    },
    staleTime: 60_000,
  });

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-(--ssz-text-primary)">{t('title')}</h3>
            <p className="text-xs text-(--ssz-text-secondary)">{t('subtitle')}</p>
          </div>
          <Segmented
            size="sm"
            options={[
              { value: '7', label: t('window.7') },
              { value: '30', label: t('window.30') },
              { value: 'course', label: t('window.course') },
            ]}
            value={window}
            onValueChange={(next) => setWindow(next as WeakRulesWindow)}
            aria-label={t('windowLabel')}
          />
        </div>

        {isPending ? (
          <Skeleton className="h-24 w-full" />
        ) : isError || !data ? (
          <Note tone="warn" icon="warn">
            {t('unavailable')}
          </Note>
        ) : (
          <Rules data={data} showLearners={showLearners} />
        )}
      </CardBody>
    </Card>
  );
}

function Rules({ data, showLearners }: { data: WeakRules; showLearners: boolean }) {
  const t = useTranslations('Analytics.weakRules');
  const format = useFormatter();

  if (data.rules.length === 0) return <Note>{t('empty')}</Note>;

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-(--ssz-border-default)">
        {data.rules.map((rule) => (
          <li key={rule.atomId} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2">
            <span className="min-w-0 flex-1 text-sm font-semibold text-(--ssz-text-primary)">
              {rule.title ?? t('unnamed')}
            </span>
            <span className="text-xs text-(--ssz-text-secondary) tabular-nums">
              {t('flags', { count: rule.flags })}
              {showLearners ? ` · ${t('learners', { count: rule.learners })}` : ''}
            </span>
            <span className="text-xs text-(--ssz-text-muted)">{sources(rule, t)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-(--ssz-text-muted)">
        {data.since === null
          ? t('sinceCourse')
          : t('since', { date: format.dateTime(new Date(data.since), { dateStyle: 'medium' }) })}
      </p>
    </div>
  );
}

/** Only the sources that fired, in the order a reader trusts them: teacher first. */
function sources(rule: WeakRule, t: ReturnType<typeof useTranslations<'Analytics.weakRules'>>) {
  const parts: string[] = [];
  if (rule.bySource.teacher > 0) parts.push(t('source.teacher', { count: rule.bySource.teacher }));
  if (rule.bySource.aiReview > 0)
    parts.push(t('source.aiReview', { count: rule.bySource.aiReview }));
  if (rule.bySource.aiPrecheck > 0) {
    parts.push(t('source.aiPrecheck', { count: rule.bySource.aiPrecheck }));
  }
  return parts.join(' · ');
}
