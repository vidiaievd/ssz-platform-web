import { getTranslations } from 'next-intl/server';

import { LoginForm } from '@/features/auth/components/login-form';

type Props = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const t = await getTranslations('Auth.Login');
  const { redirect } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="mt-1 text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>
      <LoginForm redirect={redirect} />
    </div>
  );
}
