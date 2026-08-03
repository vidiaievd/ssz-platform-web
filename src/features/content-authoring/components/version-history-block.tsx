'use client';

import { useLocale, useTranslations } from 'next-intl';
import { History } from 'lucide-react';

import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/lib/i18n/config';
import type { ContainerVersion } from '@/features/content/types';

import { useContainerVersions } from '../api/use-container-versions';

/** Newest first. The backend sorts by version number, but not every caller can rely on that. */
function byVersionDesc(a: ContainerVersion, b: ContainerVersion) {
  return b.versionNumber - a.versionNumber;
}

function VersionRow({ version }: { version: ContainerVersion }) {
  const t = useTranslations('Authoring.history');
  const locale = useLocale() as Locale;

  // A draft has no publish date, and a deprecated version's own `publishedAt`
  // is when *it* went live — the honest date for both.
  const date = version.publishedAt ?? version.createdAt;

  return (
    <li className="border-l-2 border-border py-2 pl-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-xs font-semibold text-foreground">
          {t('versionNumber', { number: version.versionNumber })}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {t(`status.${version.status}` as 'status.published')}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(new Date(date), locale, { dateStyle: 'medium', timeStyle: 'short' })}
        </span>
      </div>
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
        {version.changelog?.trim() ? version.changelog : <em>{t('noNotes')}</em>}
      </p>
    </li>
  );
}

/**
 * What was released, when, and what the author said about it.
 *
 * Read-only on purpose: rolling back means replacing the current draft's
 * composition with an old version's, which is destructive and has no backend
 * command yet (plan 33 step 5).
 */
export function VersionHistoryBlock({ containerId }: { containerId: string }) {
  const t = useTranslations('Authoring.history');
  const { data: versions, isLoading, isError } = useContainerVersions(containerId);

  const rows = [...(versions ?? [])].sort(byVersionDesc);

  return (
    <div className="space-y-3 border-t border-border pt-6">
      <div className="flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="text-xs font-bold tracking-wide text-muted-foreground">{t('title')}</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <p className="text-xs text-destructive">{t('loadError')}</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((version) => (
            <VersionRow key={version.id} version={version} />
          ))}
        </ul>
      )}
    </div>
  );
}
