'use client';

import { Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/lib/i18n/navigation';
import { LogoutButton } from '@/features/auth/components/logout-button';
import { useMyProfile } from '@/features/profile/api/use-my-profile';
import type { CurrentUser } from '@/features/auth/types/current-user';

type UserMenuProps = {
  user: CurrentUser;
};

function getRoleLabel(t: ReturnType<typeof useTranslations<'UserMenu'>>, roles: string[]): string {
  if (roles.includes('school_admin')) return t('role_school');
  if (roles.includes('tutor')) return t('role_tutor');
  if (roles.includes('student')) return t('role_student');
  return '';
}

function getRoleInitial(roles: string[]): string {
  if (roles.includes('school_admin')) return 'SC';
  if (roles.includes('tutor')) return 'TU';
  if (roles.includes('student')) return 'ST';
  return '?';
}

function getSettingsHref(roles: string[]): '/school/settings/profile' | '/student/settings/profile' {
  return roles.includes('school_admin') || roles.includes('tutor')
    ? '/school/settings/profile'
    : '/student/settings/profile';
}

export function UserMenu({ user }: UserMenuProps) {
  const t = useTranslations('UserMenu');
  const roleLabel = getRoleLabel(t, user.roles);
  const initial = getRoleInitial(user.roles);
  const settingsHref = getSettingsHref(user.roles);

  const { data: profile } = useMyProfile();
  const displayName = profile?.displayName ?? roleLabel;
  const avatarSrc = profile?.avatarUrl ?? undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="User menu"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar name={displayName || initial} src={avatarSrc} alt={displayName} size="md" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{displayName}</p>
          {profile?.displayName && (
            <p className="text-xs text-(--ssz-text-muted)">{roleLabel}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={settingsHref} className="flex items-center gap-2 cursor-pointer">
            <Settings className="size-4" />
            {t('settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <LogoutButton variant="ghost" size="sm" className="w-full justify-start px-2 h-8">
            {t('signOut')}
          </LogoutButton>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
