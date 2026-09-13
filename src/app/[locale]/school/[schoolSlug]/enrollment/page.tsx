import { redirect } from 'next/navigation';
import { wsHref } from '@/features/workspaces/lib/href';

type Props = {
  params: Promise<{ locale: string; schoolSlug: string }>;
};

export default async function EnrollmentIndexPage({ params }: Props) {
  const { locale, schoolSlug } = await params;
  redirect(`/${locale}${wsHref(schoolSlug, 'enrollment/settings')}`);
}
