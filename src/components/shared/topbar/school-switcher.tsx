'use client';

import { ChevronsUpDown, Check, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

import { cn } from '@/lib/utils';
import { useMySchools } from '@/features/school/api/use-schools';
import type { School } from '@/features/school/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  currentSchool: { name: string; slug: string };
};

function monogram(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function SchoolSwitcher({ currentSchool }: Props) {
  const router = useRouter();
  const locale = useLocale();
  const { data: schools, isLoading } = useMySchools();

  function handleSelect(slug: string) {
    if (slug !== currentSchool.slug) {
      router.push(`/${locale}/school/${slug}/dashboard`);
    }
  }

  function handleCreateNew() {
    router.push(`/${locale}/onboarding/school`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium',
          'text-(--ssz-text-primary) hover:bg-accent transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'max-w-[200px]',
        )}
        aria-label={`School: ${currentSchool.name}. Click to switch`}
      >
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded bg-primary text-[10px] font-bold text-white">
          {monogram(currentSchool.name)}
        </span>
        <span className="truncate hidden sm:block">{currentSchool.name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-(--ssz-text-muted)" aria-hidden="true" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-(--ssz-text-muted) font-normal">
          Your schools
        </DropdownMenuLabel>

        {isLoading ? (
          <>
            <DropdownMenuItem disabled>
              <Skeleton className="h-4 w-full" />
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Skeleton className="h-4 w-3/4" />
            </DropdownMenuItem>
          </>
        ) : schools && schools.length > 0 ? (
          schools.map((school: School) => {
            const isActive = school.slug === currentSchool.slug;
            return (
              <DropdownMenuItem
                key={school.id}
                onSelect={() => handleSelect(school.slug ?? school.id)}
                className={cn(
                  'flex items-center gap-2.5 cursor-pointer',
                  isActive && 'bg-primary/10 text-primary',
                )}
              >
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded bg-primary/20 text-[10px] font-bold text-primary">
                  {monogram(school.name)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{school.name}</p>
                  {school.slug && (
                    <p className="truncate text-[11px] text-(--ssz-text-muted)">{school.slug}</p>
                  )}
                </div>
                {isActive && <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />}
              </DropdownMenuItem>
            );
          })
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleCreateNew}
          className="flex items-center gap-2 cursor-pointer text-primary"
        >
          <Plus className="size-4" aria-hidden="true" />
          <span>Create a new school</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
