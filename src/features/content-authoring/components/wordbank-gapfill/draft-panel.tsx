'use client';

import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GAPFILL_AI_DRAFTS_ENABLED } from '@/lib/config/feature-flags';

export interface DraftPanelProps {
  /** The pending draft text, or `null` when there is none. */
  draft: string | null;
  disabled?: boolean;
  onAccept: () => void;
  /** Puts the draft in the field for the teacher to edit; acceptance follows from typing. */
  onRewrite: () => void;
  onReject: () => void;
}

/**
 * An unaccepted AI draft, and what can be done with it.
 *
 * A draft is not an explanation yet. It does not reach a student, it does not count
 * towards coverage, and it is shown here as something to decide about rather than as
 * text already in the field — which is why accepting is an explicit act and not the
 * absence of a rejection.
 *
 * Nothing here can appear until generation exists: with the flag off there are no
 * drafts to render and no button to draft one. Both surfaces stay in the code so that
 * the storage they read has been in place, and exercised, since before it was needed.
 */
export function DraftPanel({
  draft,
  disabled = false,
  onAccept,
  onRewrite,
  onReject,
}: DraftPanelProps) {
  const t = useTranslations('Authoring');
  if (draft === null) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-border bg-[var(--ssz-bg-subtle)] p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5" aria-hidden />
        {t('gapFill.draft.label')}
      </p>
      <p className="text-sm">{draft}</p>
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={disabled} onClick={onAccept}>
          {t('gapFill.draft.accept')}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onRewrite}>
          {t('gapFill.draft.rewrite')}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onReject}>
          {t('gapFill.draft.reject')}
        </Button>
      </div>
    </div>
  );
}

export interface DraftActionProps {
  disabled?: boolean;
  onDraft: () => void;
}

/**
 * "Draft this with AI" — the hook the generator will attach to, at the two places the
 * handoff names: a gap's default explanation, and the matrix cell editor.
 *
 * Absent, not disabled, while the flag is off: a control that cannot do anything is
 * worse than no control, and this one has nothing behind it yet.
 */
export function DraftAction({ disabled = false, onDraft }: DraftActionProps) {
  const t = useTranslations('Authoring');
  if (!GAPFILL_AI_DRAFTS_ENABLED) return null;

  return (
    <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onDraft}>
      <Sparkles className="size-3.5" aria-hidden />
      {t('gapFill.draft.action')}
    </Button>
  );
}
