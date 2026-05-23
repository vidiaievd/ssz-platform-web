import { getTranslations } from 'next-intl/server';

import { RequestsList } from '@/features/enrollment/components/requests-list';

export default async function EnrollmentRequestsPage() {
  const t = await getTranslations('Enrollment');

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{t('requests.title')}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t('requests.subtitle')}</p>
      </div>

      <RequestsList />
    </main>
  );
}
