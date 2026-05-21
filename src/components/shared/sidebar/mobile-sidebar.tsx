'use client';

import { useTranslations } from 'next-intl';

import { TooltipProvider } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SidebarSection } from './sidebar-section';
import type { NavSection } from './types';

type MobileSidebarProps = {
  sections: NavSection[];
  open: boolean;
  onClose: () => void;
};

export function MobileSidebar({ sections, open, onClose }: MobileSidebarProps) {
  const t = useTranslations('Common');

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-60 p-0 flex flex-col">
        <SheetHeader className="px-4 py-4 border-b border-border">
          <SheetTitle className="text-sm font-semibold text-left">
            {t('appName')}
          </SheetTitle>
        </SheetHeader>
        <TooltipProvider>
          <nav className="flex flex-col gap-6 px-2 py-4 flex-1 overflow-y-auto">
            {sections.map((section, i) => (
              <SidebarSection key={i} {...section} collapsed={false} />
            ))}
          </nav>
        </TooltipProvider>
      </SheetContent>
    </Sheet>
  );
}
