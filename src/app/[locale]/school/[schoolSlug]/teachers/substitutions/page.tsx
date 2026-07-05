import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ locale: string; schoolSlug: string }>;
};

export default async function SubstitutionsRedirectPage({ params }: Props) {
  const { locale, schoolSlug } = await params;
  redirect(`/${locale}/school/${schoolSlug}/scheduling/cover`);
}
