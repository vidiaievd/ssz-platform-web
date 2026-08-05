'use client';

import { useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getLessonTypeDefinition, type MaterialKind } from '@/lib/content/lesson-types';

import { ContainerStateBadge } from './container-state-badge';
import { SaveStatusIndicator } from './save-status-indicator';
import { SaveScopeHint, SaveScopeProvider } from './save-scope';
import { PhoneFrame } from './phone-frame';
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
  saveStatus,
  savedAt,
  publishSlot,
  preview,
  children,
}: LessonEditorShellProps) {
  const t = useTranslations('Authoring');
  const tContent = useTranslations('Content');
  const [showPreview, setShowPreview] = useState(true);
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
            <SaveScopeHint isLive={isLive} className="mt-1.5" />
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

      <div
        className={`grid items-start gap-6 ${showPreview ? 'lg:grid-cols-[1fr_340px]' : 'grid-cols-1'}`}
      >
        <div>{children}</div>
        {showPreview && (
          <div className="sticky top-4 flex flex-col items-center gap-3">
            <div className="flex w-75 items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('editor.previewLabel')}
              </span>
              <Badge variant="primary">{t('editor.previewLive')}</Badge>
            </div>
            <PhoneFrame>{preview}</PhoneFrame>
            <p className="max-w-75 text-center text-xs leading-relaxed text-muted-foreground">
              {t('editor.previewCaption')}
            </p>
          </div>
        )}
      </div>
    </SaveScopeProvider>
  );
}
