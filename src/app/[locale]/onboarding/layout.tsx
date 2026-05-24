import { getTranslations } from 'next-intl/server';

import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('Common');

  return (
    <div className="flex min-h-screen flex-col bg-(--ssz-bg-base)">
      <header className="flex items-center justify-between px-4 py-3 border-b border-(--ssz-border-base)">
        <span className="text-sm font-semibold text-(--ssz-text-primary)">{t('appName')}</span>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center p-4 pt-12">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}
