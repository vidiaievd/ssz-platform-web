import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getMySchoolRole } from '@/features/school/api/get-my-school-role';
import { getEnrollmentProvider } from '@/lib/enrollment/provider';
import { SettingsLayout } from '@/components/shared/settings-layout';

const ALLOWED_ROLES = ['OWNER', 'ADMIN'] as const;

type Props = {
  children: ReactNode;
  params: Promise<{ schoolSlug: string }>;
};

export default async function EnrollmentLayout({ children, params }: Props) {
  const { schoolSlug } = await params;

  const role = await getMySchoolRole(schoolSlug);
  if (!role || !(ALLOWED_ROLES as readonly string[]).includes(role)) {
    notFound();
  }

  const t = await getTranslations('Enrollment.Admin');

  // Fetch settings to decide whether to show the Requests tab
  const provider = getEnrollmentProvider();
  const settings = await provider.getSchoolSettings(schoolSlug);
  const showRequests = settings.approval.mode === 'manual';

  const nav = [
    {
      href: `/school/${schoolSlug}/enrollment/settings`,
      label: t('navSettings'),
    },
    {
      href: `/school/${schoolSlug}/enrollment/placement`,
      label: t('navPlacement'),
    },
    ...(showRequests
      ? [
          {
            href: `/school/${schoolSlug}/enrollment/requests`,
            label: t('navRequests'),
          },
        ]
      : []),
  ];

  return <SettingsLayout nav={nav}>{children}</SettingsLayout>;
}
