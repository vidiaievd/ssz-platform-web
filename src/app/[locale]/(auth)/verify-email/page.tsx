import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { VerifyEmailStatus } from '@/features/auth/components/verify-email-status';

type VerifyEmailPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const t = await getTranslations('Auth.VerifyEmail');
  const { token } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary)">{t('verifying')}</h1>
      </div>
      {token ? (
        <Suspense
          fallback={
            <p className="text-center text-sm text-(--ssz-text-muted)">{t('verifying')}</p>
          }
        >
          <VerifyEmailStatus token={token} />
        </Suspense>
      ) : (
        <p className="text-center text-sm text-error">{t('errorDescription')}</p>
      )}
    </div>
  );
}
