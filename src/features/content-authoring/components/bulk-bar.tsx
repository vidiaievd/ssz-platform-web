'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { StubButton } from './stub-controls';

interface BulkBarProps {
  /** How many blocks are ticked. The bar is not rendered below one. */
  count: number;
  onDelete: () => void;
  onClear: () => void;
  pending?: boolean;
  /**
   * False while the confirmation dialog is open. Escape belongs to the dialog
   * then, and clearing the selection underneath it would leave the dialog
   * asking about blocks that are no longer chosen.
   */
  escapeClears?: boolean;
}

/**
 * The bar that appears once blocks are ticked, floating over the tree.
 *
 * Duplicate / Publish / Unpublish are listed because the design lists them, but
 * none of the three exists in content-service yet (plan 38 §3 B1, B2), so they
 * are stubs. Removing blocks and clearing the selection genuinely work.
 */
export function BulkBar({ count, onDelete, onClear, pending, escapeClears = true }: BulkBarProps) {
  const t = useTranslations('Authoring.bulk');

  // Escape is the way out of a selection everywhere else in the app, and an
  // author who ticked a dozen rows by mistake should not have to untick them.
  useEffect(() => {
    if (count === 0 || !escapeClears) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClear();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [count, escapeClears, onClear]);

  if (count === 0) return null;

  const action =
    'inline-flex h-7 items-center rounded-full bg-white/10 px-2.5 text-xs transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-50';

  return (
    <div
      role="toolbar"
      aria-label={t('label')}
      className="fixed bottom-6 left-1/2 z-70 flex -translate-x-1/2 items-center gap-3 rounded-full bg-neutral-900 px-3 py-2 text-sm text-white shadow-[var(--ssz-shadow-xl)]"
    >
      <b className="px-1 font-semibold">{t('selected', { count })}</b>
      <StubButton label={t('duplicate')} className="bg-white/10" />
      <StubButton label={t('publish')} className="bg-white/10" />
      <StubButton label={t('unpublish')} className="bg-white/10" />
      <button type="button" disabled={pending} onClick={onDelete} className={action}>
        {t('delete')}
      </button>
      <button type="button" onClick={onClear} className={action}>
        {t('clear')}
      </button>
    </div>
  );
}
