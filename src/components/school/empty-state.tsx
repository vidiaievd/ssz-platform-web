'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Building2, MailOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

// ── EmptyStateActionCard ──────────────────────────────────────────────────────

type ActionCardProps = {
  icon: React.ReactNode;
  title: string;
  helper: string;
  href: string;
  variant?: 'primary' | 'secondary';
};

function EmptyStateActionCard({ icon, title, helper, href, variant = 'secondary' }: ActionCardProps) {
  const headingId = `esc-${title.toLowerCase().replace(/\s+/g, '-')}`;
  const helperId = `${headingId}-help`;

  return (
    <Link
      href={href}
      aria-describedby={helperId}
      className={cn(
        'group flex flex-col gap-4 rounded-[var(--ssz-radius-lg)] border p-6',
        'transition-[colors,box-shadow] duration-[var(--ssz-duration-base)]',
        'hover:bg-[var(--ssz-bg-subtle)] hover:shadow-[var(--ssz-shadow-sm)]',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color:oklch(0.62_0.105_168_/_0.30)]',
        variant === 'primary'
          ? 'border-[var(--ssz-color-primary-300)]'
          : 'border-[var(--ssz-border-default)]',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-[var(--ssz-radius-md)]',
          variant === 'primary'
            ? 'bg-[var(--ssz-color-primary-50)] text-[var(--ssz-color-primary-600)]'
            : 'bg-[var(--ssz-color-secondary-50)] text-[var(--ssz-color-secondary-700)]',
        )}
        aria-hidden
      >
        {icon}
      </div>

      <div className="flex-1">
        <p id={headingId} className="font-semibold text-(--ssz-text-primary)">
          {title}
        </p>
        <p id={helperId} className="mt-1 text-sm text-(--ssz-text-secondary) leading-[1.5]">
          {helper}
        </p>
      </div>
    </Link>
  );
}

// ── SchoolEmptyState ──────────────────────────────────────────────────────────

type SchoolEmptyStateProps = {
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

export function SchoolEmptyState({ isLoading, error, onRetry }: SchoolEmptyStateProps) {
  const t = useTranslations('School');
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-8 py-16 px-4">
        <Skeleton className="aspect-[5/3] w-full max-w-md rounded-[var(--ssz-radius-lg)]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
          <Skeleton className="h-36 rounded-[var(--ssz-radius-lg)]" />
          <Skeleton className="h-36 rounded-[var(--ssz-radius-lg)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-8 py-16 px-4">
      {error && (
        <Alert variant="error" className="w-full max-w-3xl">
          <span>{error}</span>
          {onRetry && (
            <Button variant="ghost" size="sm" onClick={onRetry} className="mt-2">
              Retry
            </Button>
          )}
        </Alert>
      )}

      {/* Illustration placeholder */}
      <div
        className="aspect-[5/3] w-full max-w-md rounded-[var(--ssz-radius-lg)] bg-[var(--ssz-bg-subtle)] border border-(--ssz-border-default)"
        aria-hidden
      />

      <div className="text-center max-w-prose">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-[Lora] text-3xl md:text-4xl leading-[1.25] text-(--ssz-text-primary) focus-visible:outline-none"
        >
          {t('empty.title')}
        </h1>
        <p className="mt-3 text-(--ssz-text-secondary) leading-[1.5]">{t('empty.help')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
        <EmptyStateActionCard
          icon={<Building2 className="h-5 w-5" />}
          title={t('empty.create.title')}
          helper={t('empty.create.help')}
          href="/school/new"
          variant="primary"
        />
        <EmptyStateActionCard
          icon={<MailOpen className="h-5 w-5" />}
          title={t('empty.accept.title')}
          helper={t('empty.accept.help')}
          href="/school/invitations"
        />
      </div>
    </div>
  );
}
