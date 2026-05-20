import { getTranslations } from 'next-intl/server';

import { ResetPasswordForm } from '@/features/auth/components/reset-password-form';

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const t = await getTranslations('Auth.ResetPassword');
  const { token } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
      </div>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-center text-sm text-error">{t('invalidToken')}</p>
      )}
    </div>
  );
}
