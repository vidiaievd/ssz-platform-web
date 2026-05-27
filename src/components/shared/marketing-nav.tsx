import { getTranslations } from 'next-intl/server';

import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/features/auth/api/get-current-user';
import { LogoutButton } from '@/features/auth/components/logout-button';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';

function getDashboardHref(roles: string[]): string {
  return roles.some((r) => r === 'school_admin' || r === 'tutor')
    ? '/school/dashboard'
    : '/student/dashboard';
}

export async function MarketingNav() {
  const [t, tNav, tUser, user] = await Promise.all([
    getTranslations('Common'),
    getTranslations('Marketing'),
    getTranslations('UserMenu'),
    getCurrentUser(),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-(--ssz-bg-base)/95 backdrop-blur supports-[backdrop-filter]:bg-(--ssz-bg-base)/60">
      <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4">
        <Link href="/" className="text-sm font-semibold text-(--ssz-text-primary)">
          {t('appName')}
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-(--ssz-text-secondary) md:flex">
          <Link href="/#features" className="hover:text-(--ssz-text-primary) transition-colors">
            {tNav('features')}
          </Link>
          <Link href="/#pricing" className="hover:text-(--ssz-text-primary) transition-colors">
            {tNav('pricing')}
          </Link>
        </nav>

        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <div className="ml-2 flex items-center gap-2">
            {user ? (
              <>
                <LogoutButton variant="ghost" size="sm">
                  {tUser('signOut')}
                </LogoutButton>
                <Button variant="primary" size="sm" asChild>
                  <Link href={getDashboardHref(user.roles)}>{tNav('goToDashboard')}</Link>
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">{tNav('signIn')}</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                  <Link href="/register?step=org">{tNav('forSchools')}</Link>
                </Button>
                <Button variant="primary" size="sm" asChild>
                  <Link href="/register/student">{tNav('startLearning')}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
