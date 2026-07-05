import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';

import { requireRole } from '@/lib/auth/protect';
import { getQueryClient } from '@/lib/query/client';
import { getMyProfile } from '@/features/profile/api/get-my-profile';
import { getStudentProfile } from '@/features/profile/api/get-student-profile';
import { profileKeys } from '@/features/profile/api/keys';
import { AppShell } from '@/components/shared/app-shell';
import { GLOBAL_NAMESPACES, STUDENT_NAMESPACES } from '@/lib/i18n/messages';
import { pickMessages } from '@/lib/i18n/pick-messages';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole('student');
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  const studentProfile = await getStudentProfile();
  if (!studentProfile) redirect(`/${locale}/onboarding`);

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: profileKeys.me(),
    queryFn: getMyProfile,
  });

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={pickMessages(messages, [...GLOBAL_NAMESPACES, ...STUDENT_NAMESPACES])}
    >
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AppShell variant="student" user={user}>
          {children}
        </AppShell>
      </HydrationBoundary>
    </NextIntlClientProvider>
  );
}
