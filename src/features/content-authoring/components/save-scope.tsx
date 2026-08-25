'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { Radio, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Whether the material being edited is placed by its container's *currently
 * published* version — i.e. whether a student can open it right now.
 * `null` when that container has never been published.
 *
 * The value decides what a save means, and the two meanings are genuinely
 * different (plan 33 §1): the editors rewrite a shared row, so editing live
 * material reaches students the moment it is saved, with no publish and no
 * undo. Material students cannot open yet is safe to rework — nothing leaves
 * the draft until the module is published.
 */
const SaveScopeContext = createContext<boolean | null | undefined>(undefined);

export function SaveScopeProvider({
  isLive,
  children,
}: {
  isLive: boolean | null;
  children: ReactNode;
}) {
  return <SaveScopeContext.Provider value={isLive}>{children}</SaveScopeContext.Provider>;
}

/**
 * Sentence to hang under a save confirmation, saying which of the two things
 * the save just did. For panes that hold `isLive` themselves — they render the
 * provider, so they sit above it and cannot read the context.
 */
export function useSaveScopeText(isLive: boolean | null): string {
  const t = useTranslations('Authoring.saveScope');
  return isLive ? t('liveToast') : t('draftToast');
}

/**
 * Same sentence for the sub-panels inside an editor, which save on their own
 * and know nothing about the material they belong to. `undefined` outside a
 * provider, so a toast without the context stays exactly as it was.
 */
export function useSaveScopeDescription(): string | undefined {
  const isLive = useContext(SaveScopeContext);
  const t = useTranslations('Authoring.saveScope');

  if (isLive === undefined) return undefined;
  return isLive ? t('liveToast') : t('draftToast');
}

/**
 * Standing notice in the editor header. Unlike the toast it is there *before*
 * the author types — the point is to warn that a typo fix on live material is
 * public the second it is saved, not to explain it afterwards.
 *
 * Two or three words on screen, the whole sentence underneath them. The header is
 * a working bar over two scrolling columns, not a page title: the sentence cost
 * the step rail some 250px, which is why it used to be dropped below 1180px —
 * and a warning that disappears exactly where space is tightest is a warning the
 * narrow screen never gets. The chip fits at any width, so it is shown at every
 * width; the sentence stays reachable as the element's title and is what a screen
 * reader reads, since it is the part that actually explains anything.
 */
export function SaveScopeHint({
  isLive,
  heldForPublish = false,
  className,
}: {
  isLive: boolean | null;
  /**
   * True where a save cannot reach a student whatever `isLive` says — exercises,
   * whose document waits in a draft until the module is published. The live/draft
   * distinction above is about *placement*, and for these it no longer decides
   * anything: promising "this is public the moment you save it" would be false.
   */
  heldForPublish?: boolean;
  className?: string;
}) {
  const t = useTranslations('Authoring.saveScope');
  const live = isLive && !heldForPublish;
  const Icon = live ? Radio : TriangleAlert;
  const sentence = heldForPublish ? t('exerciseDraftHint') : live ? t('liveHint') : t('draftHint');
  const chip = heldForPublish ? t('exerciseDraftChip') : live ? t('liveChip') : t('draftChip');

  return (
    <p
      title={sentence}
      className={`flex items-center gap-1.5 text-xs ${live ? 'text-primary' : 'text-muted-foreground'} ${className ?? ''}`}
    >
      <Icon size={13} aria-hidden />
      <span aria-hidden>{chip}</span>
      <span className="sr-only">{sentence}</span>
    </p>
  );
}
