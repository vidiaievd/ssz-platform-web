'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { History, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/i18n/formatters';
import type { Locale } from '@/lib/i18n/config';
import type { ContainerVersion } from '@/features/content/types';

import { useContainerVersions } from '../api/use-container-versions';
import { rollbackContainerAction } from '../actions/rollback-container';
import { authoringKeys } from '../api/keys';

/** Newest first. The backend sorts by version number, but not every caller can rely on that. */
function byVersionDesc(a: ContainerVersion, b: ContainerVersion) {
  return b.versionNumber - a.versionNumber;
}

function VersionRow({
  version,
  onRestore,
  disabled,
}: {
  version: ContainerVersion;
  onRestore: () => void;
  disabled: boolean;
}) {
  const t = useTranslations('Authoring.history');
  const locale = useLocale() as Locale;

  // A draft has no publish date, and a deprecated version's own `publishedAt`
  // is when *it* went live — the honest date for both.
  const date = version.publishedAt ?? version.createdAt;
  // A deprecated version with no sunset date was taken off air by hand rather
  // than replaced by a newer release — "Replaced" would name a successor that
  // does not exist.
  const withdrawn = version.status === 'deprecated' && !version.sunsetAt;
  // Only a superseded version can come back: a draft was never live, and the
  // current one already is. The backend refuses the rest anyway.
  const canRestore = version.status === 'deprecated';

  return (
    <li className="flex items-start gap-2 border-l-2 border-border py-2 pl-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-xs font-semibold text-foreground">
            {t('versionNumber', { number: version.versionNumber })}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {withdrawn
              ? t('status.withdrawn')
              : t(`status.${version.status}` as 'status.published')}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(new Date(date), locale, { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {version.changelog?.trim() ? version.changelog : <em>{t('noNotes')}</em>}
        </p>
      </div>
      {canRestore && (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          disabled={disabled}
          onClick={onRestore}
          aria-label={t('restoreAriaLabel', { number: version.versionNumber })}
        >
          <Undo2 aria-hidden /> {t('restore')}
        </Button>
      )}
    </li>
  );
}

/**
 * What was released, when, what the author said about it — and the way back.
 *
 * Restoring is a publish, not a staging step: the old version goes live at
 * once, which is the only useful shape for undoing a bad release. It restores
 * composition, not item content — an exercise rewritten since stays rewritten
 * (plan 33 §1) — so the confirmation says as much.
 */
export function VersionHistoryBlock({ containerId }: { containerId: string }) {
  const t = useTranslations('Authoring.history');
  const queryClient = useQueryClient();
  const { data: versions, isLoading, isError } = useContainerVersions(containerId);
  const [restoring, setRestoring] = useState<ContainerVersion | null>(null);
  const [isPending, startTransition] = useTransition();

  const rows = [...(versions ?? [])].sort(byVersionDesc);

  function handleConfirm() {
    const version = restoring;
    if (!version || isPending) return;

    startTransition(async () => {
      const result = await rollbackContainerAction(containerId, version.id);
      if (!result.ok) {
        toast.error(t('restoreError'));
        return;
      }
      await queryClient.invalidateQueries({ queryKey: authoringKeys.versions(containerId) });
      await queryClient.invalidateQueries({ queryKey: authoringKeys.containers() });
      toast.success(t('restoreSuccess', { number: version.versionNumber }));
      setRestoring(null);
    });
  }

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
            <VersionRow
              key={version.id}
              version={version}
              disabled={isPending}
              onRestore={() => setRestoring(version)}
            />
          ))}
        </ul>
      )}

      <AlertDialog
        open={restoring !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setRestoring(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                <Undo2 className="h-4 w-4 text-primary" aria-hidden />
              </span>
              <AlertDialogTitle>
                {t('restoreTitle', { number: restoring?.versionNumber ?? 0 })}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription>{t('restoreBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>{t('restoreCancel')}</AlertDialogCancel>
            <Button
              variant="primary"
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              loading={isPending}
            >
              {t('restoreConfirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
