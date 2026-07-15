'use client';

import { useState, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/lib/i18n/navigation';
import { getLessonTypeDefinition, type MaterialKind } from '@/lib/content/lesson-types';

import { ContainerStateBadge } from './container-state-badge';
import { AutosaveIndicator } from './autosave-indicator';
import { PhoneFrame } from './phone-frame';
import type { AutosaveStatus } from '../hooks/use-autosave';

interface LessonEditorShellProps {
  kind: MaterialKind;
  title: string;
  state: 'draft' | 'published' | null;
  backHref: string;
  autosaveStatus: AutosaveStatus;
  autosaveSavedAt: Date | null;
  /** Composed by the caller, e.g. `<PublishDialog container={container} result={preflight} />`. */
  publishSlot: ReactNode;
  preview: ReactNode;
  children: ReactNode;
}

export function LessonEditorShell({
  kind,
  title,
  state,
  backHref,
  autosaveStatus,
  autosaveSavedAt,
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
    <div>
      <Link
        href={backHref}
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; {t('editor.backToCourse')}
      </Link>

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
              <Badge variant="muted">{tContent(`materialType.${def.kind}` as 'materialType.text')}</Badge>
              {state && <ContainerStateBadge state={state} />}
              <AutosaveIndicator status={autosaveStatus} savedAt={autosaveSavedAt} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
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

      <div className={`grid items-start gap-6 ${showPreview ? 'lg:grid-cols-[1fr_340px]' : 'grid-cols-1'}`}>
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
    </div>
  );
}
