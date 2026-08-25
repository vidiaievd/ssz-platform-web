'use client';

import { useState, type ReactNode } from 'react';
import { Eye, EyeOff, Monitor, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/segmented';
import { useMounted } from '@/hooks';
import { getLessonTypeDefinition, type MaterialKind } from '@/lib/content/lesson-types';

import { ContainerStateBadge } from './container-state-badge';
import { SaveStatusIndicator } from './save-status-indicator';
import { SaveScopeHint, SaveScopeProvider } from './save-scope';
import { EditorToolbarProvider, useEditorToolbarTarget } from './editor-toolbar';
import { PhoneFrame } from './phone-frame';
import { DesktopFrame } from './desktop-frame';
import type { SaveStatus } from '../hooks/use-unsaved-changes';

interface LessonEditorShellProps {
  kind: MaterialKind;
  title: string;
  state: 'draft' | 'published' | null;
  /**
   * Whether students can open this material right now — see `SaveScopeContext`.
   * Required, because a save whose reach is unstated is the problem this prop
   * exists to fix.
   */
  isLive: boolean | null;
  /** Editors whose saves cannot reach a student before a publish — see `SaveScopeHint`. */
  savesHeldForPublish?: boolean;
  saveStatus: SaveStatus;
  savedAt: Date | null;
  /** Composed by the caller, e.g. `<PublishDialog container={container} result={preflight} />`. */
  publishSlot: ReactNode;
  preview: ReactNode;
  children: ReactNode;
}

export function LessonEditorShell({
  kind,
  title,
  state,
  isLive,
  savesHeldForPublish,
  saveStatus,
  savedAt,
  publishSlot,
  preview,
  children,
}: LessonEditorShellProps) {
  const t = useTranslations('Authoring');
  const tContent = useTranslations('Content');
  const [showPreview, setShowPreview] = useState(true);
  /**
   * Which screen the preview stands for. Two devices rather than a width slider
   * because the layouts a learner can get are two, not a continuum — and the phone
   * one is the one an author is least able to check for themselves.
   */
  const [device, setDevice] = useState<'phone' | 'desktop'>('phone');
  /**
   * The window's location bar says where the preview is served from — the real host,
   * read after mount so the server and the client agree. The specs draw a full path
   * here; this shell does not know the reader's route for the material being edited,
   * and a plausible invented one would be the one thing in the preview that lies.
   */
  const mounted = useMounted();
  const previewAddress = mounted ? window.location.host : undefined;
  const [toolbarElement, setToolbarElement] = useEditorToolbarTarget();
  const def = getLessonTypeDefinition(kind);

  /**
   * Where the editor and the preview stand side by side, each column scrolls on its
   * own and the split fills the window. Below that width they are stacked, and a
   * stacked pair has to scroll as one — two boxes each scrolling inside a screenful
   * would put the second one somewhere no thumb can reach.
   */
  const split = !showPreview
    ? { grid: 'grid-cols-1 overflow-auto', editor: '', panel: '' }
    : device === 'phone'
      ? {
          grid: 'overflow-auto min-[1180px]:grid-cols-[minmax(0,1fr)_430px] min-[1180px]:overflow-hidden',
          editor: 'min-[1180px]:overflow-auto',
          panel: 'min-[1180px]:min-h-0',
        }
      : {
          grid: 'overflow-auto min-[1380px]:grid-cols-[minmax(0,1fr)_760px] min-[1380px]:overflow-hidden',
          editor: 'min-[1380px]:overflow-auto',
          panel: 'min-[1380px]:min-h-0',
        };

  return (
    <SaveScopeProvider isLive={isLive}>
      {/*
        A workspace, not an article: the header band spans the width, and under it the
        two columns scroll on their own. The page around this contributes no padding —
        the preview panel has to reach the right edge of the window, which it cannot do
        from inside a padded, centred container (the specs' `.wb-body`).
      */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/*
          The name and the kind, for a screen reader only. Both are in the app's top
          bar — the name as the last crumb, the kind by the section it sits in — and a
          page still needs a heading to navigate by.
        */}
        <h1 className="sr-only">
          {title} — {tContent(`materialType.${def.kind}` as 'materialType.text')}
        </h1>

        {/*
          The workspace's own bar, under the app's: the builder's steps, and what can be
          done with the material. Nothing that the bar above already says — the back
          button and the type badge both went that way.
        */}
        <div className="flex shrink-0 items-stretch gap-3 border-b border-border bg-surface px-4">
          {state !== null && (
            <div className="flex shrink-0 items-center py-2">
              <ContainerStateBadge state={state} />
            </div>
          )}

          {/*
            Filled by the builder inside `children` — its steps, its save hint, its Done
            button. `items-stretch` so a step rail reaches the bottom of the bar and its
            underline lands on the bar's own border, the way a tab does. Empty for
            material that is not built in steps.
          */}
          <div ref={setToolbarElement} className="flex min-w-0 flex-1 items-stretch" />

          <div className="flex shrink-0 items-center gap-2 py-2">
            {/* The reach of a save, in two or three words. It used to be a sentence the
                bar could only afford above 1180px, which meant the screens with the
                least room lost the warning entirely; the chip fits everywhere and keeps
                its sentence in the title and for screen readers. */}
            <SaveScopeHint isLive={isLive} heldForPublish={savesHeldForPublish} />
            <SaveStatusIndicator status={saveStatus} savedAt={savedAt} />

            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setShowPreview((p) => !p)}
            >
              {showPreview ? (
                <>
                  <EyeOff aria-hidden /> {t('editor.hidePreview')}
                </>
              ) : (
                <>
                  <Eye aria-hidden /> {t('editor.showPreview')}
                </>
              )}
            </Button>
            {publishSlot}
          </div>
        </div>

        {/*
        The preview keeps its column in both devices — it is the thing being watched
        while the fields are edited, and a preview you have to scroll away to see is
        one you stop looking at. Switching to desktop widens that column rather than
        moving it.

        The widths and the two breakpoints are the builder specs' (`.wb-body`): the
        panel needs 430px to hold a phone with room around it. The desktop one is
        760px here rather than the spec's 660: subtract the panel's padding, the
        window's border and its inner padding and what is left has to still be wide
        enough for a desktop layout to *be* one (672px, `POOL_COLUMN_AT`). Below each
        breakpoint there is no honest way to stand the two side by side, so the
        preview drops under the editor.
      */}
        <div className={`grid min-h-0 flex-1 ${split.grid}`}>
          {/*
          `min-w-0`: a grid item is `min-width: auto` by default, so anything wide
          inside it — the feedback matrix, a long code block — grows the `1fr` track
          instead of scrolling within its own pane, and the whole page ends up with a
          horizontal scrollbar. With this, the editor column is free to be narrower
          than its content and the content does its own scrolling.
        */}
          <div className={`min-w-0 px-8 pt-6 pb-10 ${split.editor}`}>
            {/* Capped rather than stretched: form fields three thousand pixels wide are
              no easier to fill in than the screen they are on. */}
            <div className="mx-auto max-w-5xl">
              <EditorToolbarProvider element={toolbarElement}>{children}</EditorToolbarProvider>
            </div>
          </div>

          {/*
          A panel, not a frame floating on the page: its own tinted surface, its own
          header, its own scroll, pinned while the editor scrolls past it
          (`.wb-preview`). The device inside it is the only thing the switch changes.
        */}
          {showPreview && (
            <aside
              className={`flex min-w-0 flex-col overflow-hidden border-l border-border bg-(--ssz-bg-subtle) ${split.panel}`}
            >
              <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
                <Eye size={15} className="shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {t('editor.previewLabel')}
                </span>
                <span className="flex-1" />
                <Segmented
                  size="sm"
                  iconOnly
                  aria-label={t('editor.deviceLabel')}
                  value={device}
                  onValueChange={setDevice}
                  options={[
                    { value: 'phone', label: t('editor.devicePhone'), icon: Smartphone },
                    { value: 'desktop', label: t('editor.deviceDesktop'), icon: Monitor },
                  ]}
                />
                <Badge variant="primary">{t('editor.previewLive')}</Badge>
              </div>

              <div className="grid flex-1 justify-items-center overflow-auto p-4">
                {device === 'phone' ? (
                  <PhoneFrame label={t('editor.previewOnPhone')}>{preview}</PhoneFrame>
                ) : (
                  <DesktopFrame label={t('editor.previewOnDesktop')} address={previewAddress}>
                    {preview}
                  </DesktopFrame>
                )}
              </div>

              <p className="border-t border-border bg-surface px-4 py-2 text-center text-xs leading-relaxed text-muted-foreground">
                {t('editor.previewCaption')}
              </p>
            </aside>
          )}
        </div>
      </div>
    </SaveScopeProvider>
  );
}
