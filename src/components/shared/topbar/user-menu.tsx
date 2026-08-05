'use client';

import { useTransition } from 'react';
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useLocale, useTranslations } from 'next-intl';

import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/lib/i18n/navigation';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config';
import { LogoutButton } from '@/features/auth/components/logout-button';
import { useMyProfile } from '@/features/profile/api/use-my-profile';
import { useWorkspaces, type WorkspaceContext } from '@/features/workspaces';
import { RoleBadge } from '@/features/workspaces';
import type { SchoolRole } from '@/features/workspaces';
import type { CurrentUser } from '@/features/auth/types/current-user';

const THEME_OPTIONS = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
] as const;

export type UserMenuExtraItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  badge?: number;
};

type UserMenuProps = {
  user: CurrentUser;
  activeContextKey?: string;
  /** Extra links rendered above the sign-out action (e.g. student Notifications/Requests/Settings). */
  extraItems?: UserMenuExtraItem[];
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

function getActiveSchoolRole(contexts: WorkspaceContext[], activeContextKey?: string): SchoolRole | null {
  if (!activeContextKey) return null;
  const ctx = contexts.find((c) => {
    if (c.type === 'school') return `school:${c.schoolId}` === activeContextKey;
    return false;
  });
  return ctx?.type === 'school' ? ctx.role : null;
}

export function UserMenu({ user, activeContextKey, extraItems }: UserMenuProps) {
  const t = useTranslations('UserMenu');
  const tTheme = useTranslations('Theme');
  const roleLabel = getRoleLabel(t, user.roles);
  const initial = getRoleInitial(user.roles);

  const { data: profile } = useMyProfile();
  const { data: workspaces } = useWorkspaces();

  const { theme, setTheme } = useTheme();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  function switchLocale(next: Locale) {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
  const displayName = fullName || user.email || roleLabel;
  const firstName = profile?.firstName || displayName.split(' ')[0] || '';
  const avatarSrc = profile?.avatarUrl ?? undefined;

  const activeSchoolRole = getActiveSchoolRole(workspaces?.contexts ?? [], activeContextKey);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="User menu"
          className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 border border-border hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar name={displayName || initial} src={avatarSrc} alt={displayName || undefined} size="sm" />
          <span className="hidden sm:block text-sm font-medium text-(--ssz-text-primary) max-w-24 truncate">
            {firstName}
          </span>
          {activeSchoolRole && (
            <span className="hidden sm:block">
              <RoleBadge role={activeSchoolRole} />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium">{displayName}</p>
          <p className="text-xs text-(--ssz-text-muted)">{roleLabel}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account/profile" className="flex items-center gap-2 cursor-pointer">
            {t('profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/account" className="flex items-center gap-2 cursor-pointer">
            {t('settings')}
          </Link>
        </DropdownMenuItem>
        {extraItems && extraItems.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {extraItems.map(({ href, icon: Icon, label, badge }) => (
              <DropdownMenuItem key={href} asChild>
                <Link href={href} className="flex items-center gap-2 cursor-pointer">
                  <Icon className="size-4" aria-hidden />
                  <span className="flex-1">{label}</span>
                  {typeof badge === 'number' && badge > 0 && (
                    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-secondary-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                      {badge}
                    </span>
                  )}
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t('theme')}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {THEME_OPTIONS.map(({ value, icon: Icon }) => (
              <DropdownMenuItem
                key={value}
                onClick={() => setTheme(value)}
                className="flex items-center gap-2"
              >
                <Icon className="size-4" aria-hidden />
                {tTheme(value)}
                {theme === value && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>{t('language')}</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {LOCALES.map((l) => (
              <DropdownMenuItem
                key={l}
                onClick={() => switchLocale(l)}
                className="flex items-center gap-2"
              >
                {LOCALE_LABELS[l]}
                {locale === l && <span className="ml-auto text-primary">✓</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
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
