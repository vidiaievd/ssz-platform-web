'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { useCurrentUser } from '@/features/auth/api/use-current-user';

const ROLE_ORDER = ['school_admin', 'teacher', 'tutor', 'student'] as const;

export function RoleChips() {
  const t = useTranslations('Profile');
  const { data: user } = useCurrentUser();

  if (!user?.roles.length) return null;

  const sorted = ROLE_ORDER.filter((r) => user.roles.includes(r));

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map((role) => (
        <Badge key={role} variant="muted">
          {t(`roles.${role}` as Parameters<typeof t>[0])}
        </Badge>
      ))}
    </div>
  );
}
