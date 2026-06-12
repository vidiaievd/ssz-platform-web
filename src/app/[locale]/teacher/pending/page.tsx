import { getTranslations } from 'next-intl/server';
import { GraduationCap, MailOpen } from 'lucide-react';

import { requireAnyRole } from '@/lib/auth/protect';
import { LogoutButton } from '@/features/auth/components/logout-button';

export default async function TeacherPendingPage() {
  await requireAnyRole(['teacher']);
  const t = await getTranslations('TeacherPending');

  return (
    <main className="flex min-h-screen items-center justify-center bg-(--ssz-bg-base) p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <span className="inline-flex size-16 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="size-8 text-primary" />
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-(--ssz-text-primary)">
            {t('title')}
          </h1>
          <p className="text-sm text-(--ssz-text-secondary) leading-relaxed">
            {t('description')}
          </p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left">
          <MailOpen className="mt-0.5 size-4 shrink-0 text-(--ssz-text-muted)" />
          <p className="text-sm text-(--ssz-text-secondary)">{t('hint')}</p>
        </div>

        <LogoutButton variant="ghost" className="w-full">
          {t('logout')}
        </LogoutButton>
      </div>
    </main>
  );
}
