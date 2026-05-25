'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';

export function MarketingNav() {
  const t = useTranslations('Common');
  const tNav = useTranslations('Marketing');

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
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">{tNav('signIn')}</Link>
            </Button>
            <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
              <Link href="/register/school">{tNav('forSchools')}</Link>
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link href="/register/student">{tNav('startLearning')}</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
