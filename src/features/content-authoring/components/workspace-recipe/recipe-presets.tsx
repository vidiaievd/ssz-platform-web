'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { RECIPE_PRESET_IDS, type RecipePresetId } from '@/lib/shared-kernel/skills';

/**
 * The three starting points, as a radio group — plan 65, README «Пресеты».
 *
 * A card is selected when the rules are that preset exactly. Once they are edited, the
 * preset they came from stays selected with an "Edited" tag, so the author can still see
 * where they started. Arrow keys move focus round the group; Enter or Space picks.
 */
export function RecipePresets({
  selected,
  edited,
  onPick,
}: {
  selected: RecipePresetId | null;
  edited: boolean;
  /** Absent: read-only. */
  onPick?: (id: RecipePresetId) => void;
}) {
  const t = useTranslations('Settings.recipe.presets');
  const tName = useTranslations('Authoring.recipe.editor.preset');
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusable = selected ? RECIPE_PRESET_IDS.indexOf(selected) : 0;

  const move = (from: number, step: number) => {
    const next = (from + step + RECIPE_PRESET_IDS.length) % RECIPE_PRESET_IDS.length;
    refs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label={t('title')}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {RECIPE_PRESET_IDS.map((id, index) => {
          const on = id === selected;
          return (
            <button
              key={id}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={index === focusable ? 0 : -1}
              disabled={!onPick}
              onClick={() => onPick?.(id)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  move(index, 1);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  move(index, -1);
                }
              }}
              className={cn(
                'relative flex flex-col items-start gap-1 rounded-[10px] border py-3 pr-3 pl-[38px] text-left focus-visible:ring-[3px] focus-visible:ring-(--ssz-border-focus)/30 focus-visible:outline-none disabled:cursor-not-allowed',
                on
                  ? 'border-(--ssz-border-focus) bg-(--ssz-bg-accent) shadow-[inset_0_0_0_1px_var(--ssz-border-focus)]'
                  : 'border-(--ssz-border-default) enabled:hover:border-(--ssz-border-strong)',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute top-[14px] left-3 grid size-4 place-items-center rounded-full border-[1.5px]',
                  on ? 'border-(--ssz-border-focus)' : 'border-(--ssz-border-strong)',
                )}
              >
                {on && <span className="size-2 rounded-full bg-(--ssz-bg-brand-solid)" />}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {tName(id)}
                {on && edited && (
                  <span className="rounded-full bg-(--ssz-bg-muted) px-2 py-0.5 text-[10px] font-bold tracking-[0.06em] uppercase">
                    {t('edited')}
                  </span>
                )}
              </span>
              <span className="text-xs leading-[1.45] text-(--ssz-text-secondary)">
                {t(`line.${id}`)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-(--ssz-text-muted)">{t('note')}</p>
    </div>
  );
}
