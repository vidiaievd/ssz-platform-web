'use client';

import { ExternalLink, Inbox, Upload } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/utils';

import type { ContainerState } from '../types';
import { ContainerStateBadge } from './container-state-badge';
import { TopbarBreadcrumb } from './topbar-breadcrumb';

/** The two halves of the screen: the tree an author edits, the report it earns. */
export type EditorView = 'structure' | 'coverage';

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
  /** Which half is on screen. Lives in the URL, so the report can be linked to. */
  view: EditorView;
  onViewChange: (view: EditorView) => void;
  onReview: () => void;
  /** The settings drawer owns its own trigger, so it comes in as a slot. */
  settingsTrigger: React.ReactNode;
  /** The metric strip; a slot because it needs the tree, which the shell already holds. */
  metrics: React.ReactNode;
  /**
   * The draft's zeroes, drawn on the Structure tab only. Inside the header
   * rather than under it so that switching tabs changes the measured height and
   * the sticky panes below follow it (plan 64, phase 1).
   */
  healthStrip?: React.ReactNode;
  /** The shell measures the rendered header to park the sticky side panes below it. */
  ref?: React.Ref<HTMLElement>;
}

/** How much is waiting behind a button, in the colour of something unfinished. */
function CountPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1 rounded-full bg-error-100 px-1.5 text-[11px] font-bold tabular-nums text-error-700">
      {children}
    </span>
  );
}

/**
 * Page header for the structure editor, in two parts so that it can shrink
 * without a line of script.
 *
 * The sticky bar is what an author reaches for while working — the title and the
 * actions that apply to the whole course — and keeps one height whatever the
 * scroll. Below it, the views and the counts are an ordinary block and scroll
 * away with the page. The header used to fold itself on scroll; that changed the
 * page's height under the reader's finger, and every pane parked below it
 * followed frame by frame.
 *
 * The breadcrumb is in the app's top bar, where every page's is.
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
  view,
  onViewChange,
  onReview,
  settingsTrigger,
  metrics,
  healthStrip,
  ref,
}: StructureTopbarProps) {
  const t = useTranslations('Authoring');
  const format = useFormatter();

  return (
    <>
      <TopbarBreadcrumb
        items={[
          { label: t('breadcrumb.courses'), href: coursesHref },
          { label: title },
          { label: t('breadcrumb.structure') },
        ]}
      />

      {/* The negative margin and padding take the page's own top padding into
          the header's surface, so nothing shows above it. */}
      <header
        ref={ref}
        className="sticky top-0 z-30 -mt-6 !mb-0 bg-(--ssz-bg-surface) px-4 pb-2.5 pt-6"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-xl font-semibold">{title}</h1>
          {/* State and version as one chip: they are one fact — what students can
              open — and side by side as two they read as two claims that could
              disagree. The dot carries the state for anyone reading in
              greyscale. */}
          <ContainerStateBadge
            state={state}
            dot
            suffix={
              versionNumber != null ? t('topbar.version', { number: versionNumber }) : undefined
            }
          />

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {reviewInboxHref && (
              <Button asChild variant="outline" size="sm">
                <Link href={reviewInboxHref} title={t('review.inboxTrigger')}>
                  <Inbox className="size-4" />
                  {/* Icon alone below 1536px: with the title and the other three buttons the row would wrap. */}
                  <span className="max-2xl:sr-only">{t('review.inboxTrigger')}</span>
                </Link>
              </Button>
            )}
            {previewHref && (
              <Button asChild variant="outline" size="sm">
                <a
                  href={previewHref}
                  target="_blank"
                  rel="noreferrer"
                  title={t('topbar.previewAsStudent')}
                >
                  <ExternalLink className="size-4" />
                  <span className="max-2xl:sr-only">{t('topbar.previewAsStudent')}</span>
                </a>
              </Button>
            )}
            {settingsTrigger}
            <Button size="sm" onClick={onReview}>
              <Upload className="size-4" />
              {t('reviewPublish.trigger')}
              {pendingCount > 0 && <CountPill>{pendingCount}</CountPill>}
            </Button>
          </div>
        </div>
      </header>

      {/* Which half of the screen is open, and how big the course is. Together
          because they answer one question between them — the tabs say what is
          being read, the counts say what it is being read against, and splitting
          them would let a reader take the numbers for the tab's. */}
      <div
        className={cn(
          // The bottom gap is the block's own, not the strip's: the Coverage view has no
          // strip, and the gap went with it.
          '!mt-0 border-b border-border bg-(--ssz-bg-surface) px-4 pb-3.5',
          healthStrip && '!mb-0',
        )}
      >
        <div className="flex flex-wrap items-stretch justify-between gap-x-6 border-t border-border">
          <div className="flex flex-wrap items-stretch gap-x-4">
            <Tabs
              value={view}
              onValueChange={(next) => onViewChange(next as EditorView)}
              className="self-stretch"
            >
              <TabsList className="flex-1 border-b-0">
                <TabsTrigger value="structure" className="px-3">
                  {t('view.structure')}
                </TabsTrigger>
                <TabsTrigger value="coverage" className="px-3">
                  {t('view.coverage')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="self-center text-xs text-muted-foreground">
              {t('topbar.lastEdited', {
                date: format.dateTime(new Date(updatedAt), { dateStyle: 'medium' }),
              })}
            </span>
          </div>

          {/* Below 1000px the counts go: the tabs have to stay reachable, and six
              numbers wrapped over three lines are not a strip any more. */}
          {/* Nudged down: the white block runs on past the row (under it sits the
              strip's own gap), and the counts are centred in the whole of it. */}
          <div className="hidden items-center pb-1 pt-4 min-[1000px]:flex">{metrics}</div>
        </div>
        {healthStrip}
      </div>
    </>
  );
}
