import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

export default async function StudentCoursesRedirect() {
  const locale = await getLocale();
  redirect(`/${locale}/student/catalogue`);
}
