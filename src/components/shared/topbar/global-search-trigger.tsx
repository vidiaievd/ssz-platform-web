'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/components/ui/command';

export function GlobalSearchTrigger() {
  const t = useTranslations('Topbar.search');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label={t('label')}
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 text-(--ssz-text-muted) font-normal w-52 justify-start"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left truncate">{t('placeholder')}</span>
        <kbd className="pointer-events-none ml-auto hidden select-none items-center gap-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Mobile: icon-only trigger */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={t('label')}
        onClick={() => setOpen(true)}
        className="md:hidden"
      >
        <Search className="size-5" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t('placeholder')} />
        <CommandList>
          {/* TODO(backend): wire search endpoint GET /api/schools/{id}/search?q= */}
          <CommandEmpty>{t('comingSoon')}</CommandEmpty>
        </CommandList>
      </CommandDialog>
    </>
  );
}
