import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { getTutorWorkspace } from '@/features/tutoring/api/get-tutor-workspace';
import { SubmissionPanel } from '@/features/review/components/submission/submission-panel';

type Props = {
  params: Promise<{ userId: string; submissionId: string; locale: string }>;
};

export async function generateMetadata() {
  const t = await getTranslations('Review');
  return { title: t('inbox.eyebrow') };
}

/** One submission as a page of its own — the narrow-screen half of the tutor's split. */
export default async function TutorSubmissionPage({ params }: Props) {
  const { userId, submissionId, locale } = await params;

  const workspace = await getTutorWorkspace();
  if (!workspace) notFound();

  const t = await getTranslations('Review');

  return (
    <main className="flex h-full min-h-0 flex-col">
      <Link
        href={`/${locale}/tutor/${userId}/review`}
        className="flex items-center gap-1.5 px-5 pt-4 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        {t('submission.back')}
      </Link>
      <SubmissionPanel school={workspace.schoolId} id={submissionId} />
    </main>
  );
}
