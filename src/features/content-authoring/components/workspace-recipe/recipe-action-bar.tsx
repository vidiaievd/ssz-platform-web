'use client';

import { useId } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { RecipeWorkspaceKind } from './workspace-recipe-settings';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'rejected';

/**
 * The sticky bar under the recipe — plan 65, README §4 and BEHAVIOR §2.
 *
 * One line of status, chosen in a fixed order of precedence, so that a bar with a broken
 * rule never says "Unsaved changes" and a failed save never says "No unsaved changes".
 */
export function RecipeActionBar({
  kind,
  status,
  dirty,
  neverSet,
  invalid,
  onDiscard,
  onSave,
}: {
  kind: RecipeWorkspaceKind;
  status: SaveStatus;
  dirty: boolean;
  /** No recipe saved yet: "Nothing to save yet" rather than "No unsaved changes". */
  neverSet: boolean;
  /** One-based numbers of the rules that need a fix. */
  invalid: number[];
  onDiscard: () => void;
  onSave: () => void;
}) {
  const t = useTranslations('Settings.recipe.bar');
  const list = new Intl.ListFormat(useLocale(), { type: 'conjunction' });
  const captionId = useId();

  const saving = status === 'saving';
  const canSave =
    !saving && invalid.length === 0 && status !== 'rejected' && (dirty || status === 'error');

  const line: { text: string; tone: 'neutral' | 'primary' | 'success' | 'error' } = saving
    ? { text: t('saving'), tone: 'primary' }
    : status === 'error'
      ? { text: t('error'), tone: 'error' }
      : status === 'rejected'
        ? { text: t('rejectedAll'), tone: 'error' }
        : invalid.length > 0
          ? {
              text: t('invalid', { count: invalid.length, list: list.format(invalid.map(String)) }),
              tone: 'error',
            }
          : status === 'saved' && !dirty
            ? { text: t('saved'), tone: 'success' }
            : dirty
              ? { text: t('dirty'), tone: 'primary' }
              : { text: neverSet ? t('nothing') : t('clean'), tone: 'neutral' };

  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-y border-(--ssz-border-default) bg-(--ssz-bg-surface) px-4 py-3 shadow-(--ssz-shadow-md) sm:mx-0 sm:rounded-[10px] sm:border">
      <div className="min-w-0 flex-[1_1_240px]" aria-live="polite">
        <p
          className={cn(
            'flex items-center gap-2 text-sm font-semibold',
            line.tone === 'error' && 'text-(--ssz-color-error-700)',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'size-2 shrink-0 rounded-full',
              line.tone === 'neutral' && 'bg-(--ssz-border-strong)',
              line.tone === 'primary' && 'bg-(--ssz-color-primary-600)',
              line.tone === 'success' && 'bg-(--ssz-color-success-500)',
              line.tone === 'error' && 'bg-(--ssz-color-error-500)',
            )}
          />
          {line.text}
        </p>
        <p id={captionId} className="mt-0.5 text-xs text-(--ssz-text-muted)">
          {status === 'error' ? t('errorSub') : t('caption', { kind })}
        </p>
      </div>

      <div className="flex w-full gap-2 sm:w-auto">
        <button
          type="button"
          onClick={onDiscard}
          disabled={saving || !dirty}
          className="h-9 flex-1 rounded-md px-4 text-sm font-semibold hover:bg-(--ssz-bg-subtle) focus-visible:ring-[3px] focus-visible:ring-(--ssz-color-primary-500)/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:text-(--ssz-text-muted) disabled:hover:bg-transparent sm:flex-none pointer-coarse:h-11"
        >
          {t('discard')}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          aria-busy={saving || undefined}
          aria-describedby={captionId}
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-(--ssz-color-primary-600) px-4 text-sm font-semibold text-(--ssz-text-inverse) hover:bg-(--ssz-color-primary-700) focus-visible:ring-[3px] focus-visible:ring-(--ssz-color-primary-500)/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-(--ssz-bg-subtle) disabled:text-(--ssz-text-muted) sm:flex-none pointer-coarse:h-11"
        >
          {saving && (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          )}
          {saving ? t('saving') : status === 'error' ? t('retry') : t('save')}
        </button>
      </div>
    </div>
  );
}
