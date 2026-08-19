import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { getSchoolBySlug } from '@/features/school/api/get-school-by-slug';
import { SubmissionPanel } from '@/features/review/components/submission/submission-panel';

type Props = {
  params: Promise<{ schoolSlug: string; submissionId: string; locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { schoolSlug } = await params;
  const t = await getTranslations('Review');
  return { title: `${t('inbox.eyebrow')} · ${schoolSlug}` };
}

/**
 * One submission as a page of its own — the narrow-screen half of the split.
 *
 * Below 1024px the inbox hides its second column entirely, so without this route a phone
 * could open the queue and nothing in it. It is the same panel, and deliberately not a
 * different screen: a reviewer who marks on a laptop and checks the queue on a train
 * should be reading one thing in two shapes, not learning two.
 *
 * The way back is a link to the queue rather than browser history, because the usual way
 * to arrive here is a notification, where there is no history to go back through.
 */
export default async function SubmissionPage({ params }: Props) {
  const { schoolSlug, submissionId, locale } = await params;

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) notFound();

  const t = await getTranslations('Review');

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <Link
        href={`/${locale}/school/${schoolSlug}/review`}
        className="flex items-center gap-1.5 px-5 pt-4 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        {t('submission.back')}
      </Link>
      <SubmissionPanel school={school.slug ?? school.id} id={submissionId} />
    </main>
  );
}
