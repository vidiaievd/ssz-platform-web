'use client';

import { useState, type ReactNode } from 'react';
import { Eye, EyeOff, Monitor, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Segmented } from '@/components/ui/segmented';
import { getLessonTypeDefinition, type MaterialKind } from '@/lib/content/lesson-types';

import { ContainerStateBadge } from './container-state-badge';
import { SaveStatusIndicator } from './save-status-indicator';
import { SaveScopeHint, SaveScopeProvider } from './save-scope';
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
  backHref: string;
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
  const def = getLessonTypeDefinition(kind);
  const Icon = def.icon;

  return (
    <SaveScopeProvider isLive={isLive}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `color-mix(in oklch, var(${def.hueVar}) 16%, transparent)` }}
          >
            <Icon size={20} style={{ color: `var(${def.hueVar})` }} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="muted">
                {tContent(`materialType.${def.kind}` as 'materialType.text')}
              </Badge>
              {state && <ContainerStateBadge state={state} />}
              <SaveStatusIndicator status={saveStatus} savedAt={savedAt} />
            </div>
            <SaveScopeHint
              isLive={isLive}
              heldForPublish={savesHeldForPublish}
              className="mt-1.5"
            />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" type="button" onClick={() => setShowPreview((p) => !p)}>
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
        one you stop looking at. Switching to desktop widens that column instead of
        moving it: the editor track has a floor of its own, so on a narrow laptop the
        preview gives width back rather than squeezing the work out of the screen.
      */}
      <div
        className={`grid items-start gap-6 ${
          !showPreview
            ? 'grid-cols-1'
            : device === 'phone'
              ? 'lg:grid-cols-[1fr_340px]'
              : 'lg:grid-cols-[minmax(420px,1fr)_minmax(0,720px)]'
        }`}
      >
        {/*
          `min-w-0`: a grid item is `min-width: auto` by default, so anything wide
          inside it — the feedback matrix, a long code block — grows the `1fr` track
          instead of scrolling within its own pane, and the whole page ends up with a
          horizontal scrollbar. With this, the editor column is free to be narrower
          than its content and the content does its own scrolling.
        */}
        <div className="min-w-0">{children}</div>

        {showPreview && (
          <div className="sticky top-4 flex min-w-0 flex-col items-center gap-3">
            <div
              className={`flex items-center justify-between gap-2 ${
                device === 'phone' ? 'w-75' : 'w-full'
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('editor.previewLabel')}
              </span>
              <div className="flex items-center gap-2">
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
            </div>

            {device === 'phone' ? (
              <PhoneFrame label={t('editor.previewOnPhone')}>{preview}</PhoneFrame>
            ) : (
              <DesktopFrame label={t('editor.previewOnDesktop')}>{preview}</DesktopFrame>
            )}

            <p
              className={`text-center text-xs leading-relaxed text-muted-foreground ${
                device === 'phone' ? 'max-w-75' : 'w-full'
              }`}
            >
              {t('editor.previewCaption')}
            </p>
          </div>
        )}
      </div>
    </SaveScopeProvider>
  );
}
