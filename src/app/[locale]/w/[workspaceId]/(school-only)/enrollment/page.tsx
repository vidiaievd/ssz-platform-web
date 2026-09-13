import { redirect } from 'next/navigation';
import { wsHref } from '@/features/workspaces/lib/href';

type Props = {
  params: Promise<{ locale: string; workspaceId: string }>;
};

export default async function EnrollmentIndexPage({ params }: Props) {
  const { locale, workspaceId } = await params;
  redirect(`/${locale}${wsHref(workspaceId, 'enrollment/settings')}`);
}
