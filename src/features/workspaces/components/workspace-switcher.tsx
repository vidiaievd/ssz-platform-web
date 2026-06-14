'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronsUpDown, Check, UserCircle, GraduationCap } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWorkspaces, useActivateWorkspace, contextToUrl } from '../api/use-workspaces';
import { toContextKey } from '../types';
import type { WorkspaceContext } from '../types';
import { RoleBadge } from './role-badge';

type Props = {
  activeContextKey: string;
  userId?: string;
};

function monogram(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function ContextAvatar({ ctx }: { ctx: WorkspaceContext }) {
  if (ctx.type === 'school') {
    if (ctx.schoolAvatarUrl) {
      return (
        <Image
          src={ctx.schoolAvatarUrl}
          alt=""
          width={32}
          height={32}
          className="size-8 rounded-md object-cover shrink-0"
        />
      );
    }
    return (
      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/20 text-xs font-bold text-primary">
        {monogram(ctx.schoolName)}
      </span>
    );
  }
  if (ctx.type === 'private_tutor') {
    return <UserCircle className="size-8 shrink-0 text-(--ssz-text-secondary)" />;
  }
  return <GraduationCap className="size-8 shrink-0 text-(--ssz-text-secondary)" />;
}

function TriggerAvatar({ ctx }: { ctx: WorkspaceContext }) {
  if (ctx.type === 'school') {
    if (ctx.schoolAvatarUrl) {
      return (
        <Image
          src={ctx.schoolAvatarUrl}
          alt=""
          width={24}
          height={24}
          className="size-6 rounded-full object-cover shrink-0"
        />
      );
    }
    return (
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
        {monogram(ctx.schoolName)}
      </span>
    );
  }
  if (ctx.type === 'private_tutor') {
    return <UserCircle className="size-5 shrink-0" />;
  }
  return <GraduationCap className="size-5 shrink-0" />;
}

function ctxLabel(ctx: WorkspaceContext, tPrivate: string, tStudent: string): string {
  if (ctx.type === 'school') return ctx.schoolName;
  if (ctx.type === 'private_tutor') return tPrivate;
  return tStudent;
}

export function WorkspaceSwitcher({ activeContextKey, userId }: Props) {
  const t = useTranslations('WorkspaceSwitcher');
  const router = useRouter();
  const locale = useLocale();
  const { data, isLoading, isError } = useWorkspaces();
  const activate = useActivateWorkspace();

  // 1. Loading — show skeleton
  if (isLoading && !data) {
    return (
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-30 hidden sm:block" />
      </div>
    );
  }

  // 2. Error with no cached data — hide silently
  if (isError && !data) return null;

  const contexts = data?.contexts ?? [];
  const activeCtx = contexts.find((c) => toContextKey(c) === activeContextKey) ?? contexts[0];

  // 3. No matching context at all — nothing to show
  if (!activeCtx) return null;

  const label = ctxLabel(activeCtx, t('contexts.private_tutor'), t('contexts.student'));

  // 4. Single context — show static label (no dropdown)
  if (contexts.length <= 1) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-(--ssz-text-primary) min-w-0">
        <TriggerAvatar ctx={activeCtx} />
        <span className="truncate hidden sm:block">{label}</span>
      </div>
    );
  }

  // 5. Multiple contexts — full dropdown switcher
  const schoolContexts = contexts.filter((c) => c.type === 'school');
  const otherContexts = contexts.filter((c) => c.type !== 'school');

  const sortedSchools = [...schoolContexts].sort((a, b) => {
    if (a.type !== 'school' || b.type !== 'school') return 0;
    const aKey = toContextKey(a);
    const bKey = toContextKey(b);
    if (aKey === activeContextKey) return -1;
    if (bKey === activeContextKey) return 1;
    return a.schoolName.localeCompare(b.schoolName);
  });

  function handleSelect(ctx: WorkspaceContext) {
    const key = toContextKey(ctx);
    if (key === activeContextKey) return;
    router.push(contextToUrl(ctx, locale, userId));
    activate.mutate(key);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium',
          'text-(--ssz-text-primary) hover:bg-accent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'min-w-40 max-w-55',
        )}
        aria-label={t('trigger')}
      >
        <TriggerAvatar ctx={activeCtx} />
        <span className="truncate flex-1 hidden sm:block">{label}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-(--ssz-text-muted)" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-70">
        {sortedSchools.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs text-(--ssz-text-muted) font-normal uppercase tracking-wider">
              {t('sections.schools')}
            </DropdownMenuLabel>
            {sortedSchools.map((ctx) => {
              if (ctx.type !== 'school') return null;
              const key = toContextKey(ctx);
              const isActive = key === activeContextKey;
              return (
                <DropdownMenuItem
                  key={key}
                  onSelect={() => handleSelect(ctx)}
                  aria-checked={isActive}
                  aria-disabled={isActive}
                  className={cn(
                    'flex items-center gap-2.5 cursor-pointer',
                    isActive && 'bg-primary/10',
                  )}
                >
                  <Check
                    className={cn('size-3.5 shrink-0 text-primary', !isActive && 'invisible')}
                    aria-hidden="true"
                  />
                  <ContextAvatar ctx={ctx} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('truncate text-sm', isActive && 'font-medium')}>
                      {ctx.schoolName}
                    </p>
                  </div>
                  <RoleBadge role={ctx.role} />
                </DropdownMenuItem>
              );
            })}
          </>
        )}

        {otherContexts.length > 0 && (
          <>
            {sortedSchools.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs text-(--ssz-text-muted) font-normal uppercase tracking-wider">
              {t('sections.other')}
            </DropdownMenuLabel>
            {otherContexts.map((ctx) => {
              const key = toContextKey(ctx);
              const isActive = key === activeContextKey;
              return (
                <DropdownMenuItem
                  key={key}
                  onSelect={() => handleSelect(ctx)}
                  aria-checked={isActive}
                  aria-disabled={isActive}
                  className={cn(
                    'flex items-center gap-2.5 cursor-pointer',
                    isActive && 'bg-primary/10',
                  )}
                >
                  <Check
                    className={cn('size-3.5 shrink-0 text-primary', !isActive && 'invisible')}
                    aria-hidden="true"
                  />
                  <ContextAvatar ctx={ctx} />
                  <span className={cn('flex-1 text-sm', isActive && 'font-medium')}>
                    {ctx.type === 'private_tutor'
                      ? t('contexts.private_tutor')
                      : t('contexts.student')}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
