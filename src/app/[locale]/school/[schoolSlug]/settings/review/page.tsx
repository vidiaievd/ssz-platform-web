import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import { SlaSettings } from '@/features/review/components/settings/sla-settings';

type Props = {
  params: Promise<{ schoolSlug: string; locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations('Review.settings');
  return { title: `${t('title')} · ${schoolSlug}` };
}

/**
 * The response time this school promises — one number that colours the whole subsystem.
 *
 * The settings layout above already refuses anyone but an owner or an administrator, and
 * organization-service refuses them again on the write. The page passes `canEdit` through
 * anyway rather than assuming: this screen is worth reading for anyone who runs the review,
 * and a future nav that let a MANAGER in should show them the promise, greyed, rather than
 * a blank page.
 */
export default async function SchoolReviewSettingsPage({ params }: Props) {
  const { schoolSlug } = await params;

  const role = await getMySchoolRole(schoolSlug);
  if (role === null) notFound();

  const t = await getTranslations('Review.settings');

  return (
    <div className="mx-auto flex w-full max-w-[780px] flex-col gap-4 p-6 md:p-8">
      <div>
        <div className="mb-[5px] text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          {t('eyebrow')}
        </div>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">{t('title')}</h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">{t('lede')}</p>
      </div>

      <SlaSettings school={schoolSlug} canEdit={role === 'OWNER' || role === 'ADMIN'} />
    </div>
  );
}
