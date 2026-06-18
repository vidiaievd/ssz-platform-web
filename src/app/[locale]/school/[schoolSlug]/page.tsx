import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

import { WORKSPACE_DEFAULT_SEGMENT } from '@/lib/navigation/workspace-defaults';

type Props = {
  params: Promise<{ schoolSlug: string }>;
};

export default async function SchoolInstanceIndexPage({ params }: Props) {
  const { schoolSlug } = await params;
  const locale = await getLocale();

  redirect(`/${locale}/school/${schoolSlug}/${WORKSPACE_DEFAULT_SEGMENT}`);
}
