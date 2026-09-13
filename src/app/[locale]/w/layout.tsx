import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

import { requireUser } from '@/lib/auth/protect';
import { getTutorProfile } from '@/features/profile/api/get-tutor-profile';
import { GLOBAL_NAMESPACES, SCHOOL_NAMESPACES } from '@/lib/i18n/messages';
import { pickMessages } from '@/lib/i18n/pick-messages';

/**
 * The vocabulary every workspace screen speaks.
 *
 * A nested provider replaces the message context for its subtree rather than adding to it,
 * so without this the client components under `/w` fall back to the root layout's global
 * namespaces and render their keys — `Students.list.title` where a heading belongs. The
 * server components rendered correctly throughout, which is why the pages still answered
 * 200 while saying nothing a person could read.
 */
export default async function WorkspaceMessagesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  // A tutor without a tutor profile has not finished signing up; the workspace screens
  // assume one exists. Same rule the school tree has always applied.
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
