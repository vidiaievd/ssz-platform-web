import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';

// `/student` itself has no screen; accepting an invitation, signing up through enrolment, the
// signed-in redirect of the auth pages and placement all land here, so send them to the home page.
export default async function StudentRootRedirect() {
  const locale = await getLocale();
  redirect(`/${locale}/student/home`);
}
