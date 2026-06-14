'use client';

import { useTranslations } from 'next-intl';

export function NotificationsScreen() {
  const t = useTranslations('Account.notifications');

  return (
    <div className="p-6 md:p-8 space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted) mt-1">{t('subtitle')}</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">{t('channels')}</h2>
        {/* TODO(backend): GET/PATCH /notifications/preferences */}
        <p className="text-sm text-(--ssz-text-muted)">{t('comingSoon')}</p>
      </section>
    </div>
  );
}
