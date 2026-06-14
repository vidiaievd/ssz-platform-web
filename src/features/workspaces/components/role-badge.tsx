import { useTranslations } from 'next-intl';

import type { SchoolRole } from '../types';

type Props = {
  role: SchoolRole;
};

const ROLE_KEYS = {
  OWNER: 'roles.OWNER',
  ADMIN: 'roles.ADMIN',
  MANAGER: 'roles.MANAGER',
  TEACHER: 'roles.TEACHER',
  SCHEDULER: 'roles.SCHEDULER',
  CONTENT_ADMIN: 'roles.CONTENT_ADMIN',
  STUDENT: 'roles.STUDENT',
} as const satisfies Record<SchoolRole, `roles.${SchoolRole}`>;

export function RoleBadge({ role }: Props) {
  const t = useTranslations('WorkspaceSwitcher');

  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground">
      {t(ROLE_KEYS[role])}
    </span>
  );
}
