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
  /** Sidebar header slot (workspace switcher); mobile sidebar is never collapsed. */
  header?: (collapsed: boolean) => React.ReactNode;
};

export function MobileSidebar({ sections, open, onClose, header }: MobileSidebarProps) {
  const t = useTranslations('Common');

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-60 p-0 flex flex-col">
        <SheetHeader className="px-2 py-3 border-b border-border">
          <SheetTitle className="sr-only">{t('appName')}</SheetTitle>
          {header?.(false)}
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
