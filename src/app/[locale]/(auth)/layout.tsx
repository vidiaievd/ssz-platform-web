import { redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';

import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { getCurrentUser } from '@/features/auth/api/get-current-user';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (user) {
    const locale = await getLocale();
    const isMgmt = user.roles.some((r) => r === 'school_admin' || r === 'tutor');
    redirect(`/${locale}${isMgmt ? '/school' : '/student'}`);
  }

  const t = await getTranslations('Common');

  return (
    <div className="flex min-h-screen flex-col bg-(--ssz-bg-base)">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-(--ssz-text-primary)">
          {t('appName')}
        </span>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
