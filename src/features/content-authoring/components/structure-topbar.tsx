'use client';

import { ChevronsDownUp, ChevronsUpDown, ExternalLink, Inbox, Upload } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Link } from '@/lib/i18n/navigation';

import type { ContainerState } from '../types';
import { ContainerStateBadge } from './container-state-badge';

interface StructureTopbarProps {
  title: string;
  /** Course list, for the first crumb. */
  coursesHref: string;
  state: ContainerState;
  /** Number of the live version, `null` while the container has never been published. */
  versionNumber: number | null;
  /** ISO 8601 — the container's `updatedAt`. */
  updatedAt: string;
  /** How many nodes are waiting to go live; drives the badge on Review & publish. */
  pendingCount: number;
  /** Student-facing route for this course, or `null` when it is a module (students open those through their course). */
  previewHref: string | null;
  /** The course's marking inbox. `null` for containers whose material nobody hands in. */
  reviewInboxHref: string | null;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onReview: () => void;
  /** The settings drawer owns its own trigger, so it comes in as a slot. */
  settingsTrigger: React.ReactNode;
  /** The metric strip; a slot because it needs the tree, which the shell already holds. */
  metrics: React.ReactNode;
  /** The shell measures the rendered header to park the sticky side panes below it. */
  ref?: React.Ref<HTMLElement>;
}

/**
 * Page header for the structure editor: identity on the left, the actions that
 * apply to the whole course on the right. Sticky, because the tree below it is
 * long and "publish" has to stay a keystroke away from whatever is on screen.
 */
export function StructureTopbar({
  title,
  coursesHref,
  state,
  versionNumber,
  updatedAt,
  pendingCount,
  previewHref,
  reviewInboxHref,
  onExpandAll,
  onCollapseAll,
  onReview,
  settingsTrigger,
  metrics,
  ref,
}: StructureTopbarProps) {
  const t = useTranslations('Authoring');
  const format = useFormatter();

  return (
    <header
      ref={ref}
      className="ssz-surface sticky top-0 z-30 -mt-6 mb-4.5 border-b border-border px-4 pb-3.5 pt-6"
    >
      <nav className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href={coursesHref} className="transition-colors hover:text-foreground">
          {t('breadcrumb.courses')}
        </Link>
        <span aria-hidden>/</span>
        <span className="max-w-xs truncate font-medium text-foreground">{title}</span>
        <span aria-hidden>/</span>
        <span>{t('breadcrumb.structure')}</span>
      </nav>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <ContainerStateBadge state={state} />
        {versionNumber != null && (
          <span className="font-mono text-xs text-muted-foreground">
            {t('topbar.version', { number: versionNumber })}
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {t('topbar.lastEdited', {
            date: format.dateTime(new Date(updatedAt), { dateStyle: 'medium' }),
          })}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={onExpandAll}>
            <ChevronsUpDown className="size-4" />
            {t('topbar.expandAll')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCollapseAll}>
            <ChevronsDownUp className="size-4" />
            {t('topbar.collapseAll')}
          </Button>
          {reviewInboxHref && (
            <Button asChild variant="outline" size="sm">
              <Link href={reviewInboxHref}>
                <Inbox className="size-4" />
                {t('review.inboxTrigger')}
              </Link>
            </Button>
          )}
          {previewHref && (
            <Button asChild variant="outline" size="sm">
              <a href={previewHref} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                {t('topbar.previewAsStudent')}
              </a>
            </Button>
          )}
          {settingsTrigger}
          <Button size="sm" onClick={onReview}>
            <Upload className="size-4" />
            {t('reviewPublish.trigger')}
            {pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 text-[11px] font-bold">
                {pendingCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-3 border-t border-border pt-3">{metrics}</div>
    </header>
  );
}
