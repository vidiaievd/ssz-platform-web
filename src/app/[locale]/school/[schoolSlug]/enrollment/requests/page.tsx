import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getEnrollmentProvider } from '@/lib/enrollment/provider';
import { PendingApprovals } from '@/features/enrollment/components/pending-approvals';

type Props = {
  params: Promise<{ schoolSlug: string }>;
};

export default async function RequestsPage({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations('Enrollment.Approvals');

  const provider = getEnrollmentProvider();
  const settings = await provider.getSchoolSettings(schoolSlug);

  // Guard: this page should only appear for manual approval schools
  if (settings.approval.mode !== 'manual') notFound();

  const memberships = await provider.listPendingApprovals(schoolSlug);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-semibold text-(--ssz-text-primary)">{t('title')}</h1>
        <p className="text-sm text-(--ssz-text-muted)">{t('subtitle')}</p>
      </div>

      <PendingApprovals memberships={memberships} />
    </div>
  );
}
