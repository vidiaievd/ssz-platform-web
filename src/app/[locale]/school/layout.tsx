import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { requireUser } from '@/lib/auth/protect';
import { getTutorProfile } from '@/features/profile/api/get-tutor-profile';
import { GLOBAL_NAMESPACES, SCHOOL_NAMESPACES } from '@/lib/i18n/messages';
import { pickMessages } from '@/lib/i18n/pick-messages';

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  if (user.roles.includes('tutor')) {
    const tutorProfile = await getTutorProfile();
    if (!tutorProfile) redirect(`/${locale}/onboarding`);
  }

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickMessages(messages, [...GLOBAL_NAMESPACES, ...SCHOOL_NAMESPACES])}
    >
      {children}
    </NextIntlClientProvider>
  );
}
