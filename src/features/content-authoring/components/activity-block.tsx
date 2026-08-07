'use client';

import { useLocale, useTranslations } from 'next-intl';
import { History } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatRelative } from '@/lib/i18n/formatters';
import type { Locale } from '@/lib/i18n/config';

import { useContainerActivity } from '../api/use-container-activity';
import type { ActivityEntry } from '../types';

/**
 * Actions the panel has wording for. The API's `action` is deliberately
 * open-ended, so anything outside this list is shown verbatim rather than
 * crashing on a missing translation key — a new action reaching an old client
 * should read oddly, not break the panel.
 */
const KNOWN_ACTIONS = [
  'created',
  'updated',
  'deleted',
  'published',
  'unpublished',
  'archived',
  'restored',
  'instructions_updated',
] as const;

/** Field names worth naming to an author. Anything else is left as it came. */
const KNOWN_FIELDS = [
  'title',
  'description',
  'difficultyLevel',
  'coverImageMediaId',
  'visibility',
  'accessTier',
  'levelSystem',
  'gatingMode',
  'content',
  'expectedAnswers',
  'answerCheckSettings',
  'estimatedDurationSeconds',
] as const;

function isKnownAction(action: string): action is (typeof KNOWN_ACTIONS)[number] {
  return (KNOWN_ACTIONS as readonly string[]).includes(action);
}

function isKnownField(field: string): field is (typeof KNOWN_FIELDS)[number] {
  return (KNOWN_FIELDS as readonly string[]).includes(field);
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const t = useTranslations('Authoring.activity');
  const locale = useLocale() as Locale;
  const occurredAt = new Date(entry.occurredAt);

  // Phrased as a state, not a verb: "Изменено", not "изменил(а)". Past-tense
  // verbs are gendered in two of the four locales, and the actor's gender is
  // not ours to guess from a display name.
  const action = isKnownAction(entry.action)
    ? t(`action.${entry.action}` as 'action.updated')
    : entry.action;

  const fields = entry.changedFields
    .map((field) => (isKnownField(field) ? t(`field.${field}` as 'field.content') : field))
    .join(', ');

  return (
    <li className="flex flex-col gap-0.5 border-l-2 border-border py-2 pl-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-xs font-semibold text-foreground">{action}</span>
        {entry.entityTitle && (
          <span className="truncate text-xs text-muted-foreground">{entry.entityTitle}</span>
        )}
      </div>
      {fields && <span className="text-[11px] text-muted-foreground">{fields}</span>}
      <div className="flex flex-wrap items-baseline gap-x-2 text-[11px] text-muted-foreground">
        {/* An unresolved actor is still an actor: the entry stands, and naming
            it "someone" is more use to a reader than the raw user id. */}
        <span>{entry.actor?.displayName ?? t('unknownActor')}</span>
        <time
          dateTime={entry.occurredAt}
          title={formatDate(occurredAt, locale, { dateStyle: 'long', timeStyle: 'short' })}
        >
          {formatRelative(occurredAt, locale)}
        </time>
      </div>
    </li>
  );
}

/**
 * Who changed this course and the material it places.
 *
 * Answers the question an author has just before publishing — which exercise
 * moved, who touched it, when — without making them open every item to find out.
 */
export function ActivityBlock({ containerId }: { containerId: string }) {
  const t = useTranslations('Authoring.activity');
  const { data, isLoading, isError } = useContainerActivity(containerId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-bold tracking-wide text-muted-foreground">{t('title')}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : isError ? (
        <p className="text-xs text-destructive">{t('loadError')}</p>
      ) : (data?.entries.length ?? 0) === 0 ? (
        <p className="text-xs text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          <ul className="space-y-1">
            {data?.entries.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </ul>
          {data?.hasMore && <p className="text-[11px] text-muted-foreground">{t('truncated')}</p>}
        </>
      )}
    </div>
  );
}
