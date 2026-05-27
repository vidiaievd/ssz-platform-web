import { LogOut } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { LogoutButton } from '@/features/auth/components/logout-button';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('UserMenu');

  return (
    <div className="min-h-dvh bg-(--ssz-bg-base)">
      <header className="flex items-center justify-between px-4 py-3 border-b border-(--ssz-border-base)">
        <span className="text-sm font-semibold text-(--ssz-text-primary) md:hidden">SSZ</span>
        <span className="hidden md:block text-sm font-semibold text-(--ssz-text-primary) mx-auto">SSZ</span>
        <div className="flex items-center gap-1 md:absolute md:right-4 md:top-3">
          <LanguageSwitcher />
          <ThemeToggle />
          <LogoutButton variant="ghost" size="icon" aria-label={t('signOut')}>
            <LogOut className="size-4" />
          </LogoutButton>
        </div>
      </header>
      <div className="md:px-4">{children}</div>
    </div>
  );
}
