import { Suspense } from 'react';

import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import { CheckEmailScreen } from '@/features/auth/components/check-email-screen';
import { VerifyEmailStatus } from '@/features/auth/components/verify-email-status';

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col bg-(--ssz-bg-base)">
      <header className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-semibold text-(--ssz-text-primary)" />
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {token ? (
            <Suspense
              fallback={
                <p className="text-center text-sm text-(--ssz-text-muted)">…</p>
              }
            >
              <VerifyEmailStatus token={token} />
            </Suspense>
          ) : (
            <CheckEmailScreen />
          )}
        </div>
      </main>
    </div>
  );
}
