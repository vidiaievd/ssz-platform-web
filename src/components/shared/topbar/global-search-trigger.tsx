'use client';

import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

// TODO(search): wire up CommandDialog when GET /api/schools/{id}/search?q= is ready
export function GlobalSearchTrigger() {
  const t = useTranslations('Topbar.search');

  return (
    <>
      {/* Desktop: full-width disabled input look-alike */}
      <button
        type="button"
        disabled
        aria-label={t('label')}
        className="hidden md:flex items-center gap-2 h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 text-sm text-(--ssz-text-muted) opacity-50 cursor-not-allowed"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left truncate">{t('placeholder')}</span>
        <kbd className="pointer-events-none hidden select-none items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Mobile: icon-only disabled button */}
      <button
        type="button"
        disabled
        aria-label={t('label')}
        className="md:hidden flex items-center justify-center size-9 rounded-md text-(--ssz-text-muted) opacity-50 cursor-not-allowed"
      >
        <Search className="size-5" />
      </button>
    </>
  );
}
