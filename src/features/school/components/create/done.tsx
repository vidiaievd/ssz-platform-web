'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { BookOpenText, Check, Settings2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


type NextStepCardProps = {
  icon: React.ReactNode;
  title: string;
  helper: string;
  href: string;
};

function NextStepCard({ icon, title, helper, href }: NextStepCardProps) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          'flex flex-col gap-3 rounded-[var(--ssz-radius-lg)] border border-(--ssz-border-default) p-5',
          'hover:bg-[var(--ssz-bg-subtle)] hover:shadow-[var(--ssz-shadow-sm)]',
          'transition-[colors,box-shadow] duration-[var(--ssz-duration-base)]',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color:oklch(0.62_0.105_168_/_0.30)]',
        )}
      >
        <span
          className="flex h-9 w-9 items-center justify-center rounded-[var(--ssz-radius-md)] bg-[var(--ssz-color-primary-50)] text-[var(--ssz-color-primary-600)]"
          aria-hidden
        >
          {icon}
        </span>
        <div>
          <p className="font-semibold text-sm text-(--ssz-text-primary)">{title}</p>
          <p className="mt-0.5 text-xs text-(--ssz-text-secondary) leading-[1.5]">{helper}</p>
        </div>
      </Link>
    </li>
  );
}

type WizardDoneCardProps = {
  schoolName: string;
  invitedCount: number;
  /** Called when the user clicks "Go to dashboard". Parent clears the wizard store. */
  onGoToDashboard: () => void;
};

export function WizardDoneCard({ schoolName, invitedCount, onGoToDashboard }: WizardDoneCardProps) {
  const t = useTranslations('School');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    setTimeout(() => ctaRef.current?.focus(), 50);
  }, []);

  return (
    <div className="flex flex-col items-center gap-8 py-8 text-center">
      {/* Hero check */}
      <div
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full',
          'bg-(--ssz-color-primary-600) text-white',
          'motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in-0',
          'duration-(--ssz-duration-slow)',
        )}
        aria-hidden
      >
        <Check className="h-7 w-7 stroke-[2.5]" />
      </div>

      <div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-[Lora] text-3xl leading-tight text-(--ssz-text-primary) focus-visible:outline-none"
        >
          {t('create.done.title')}
        </h1>
        <p className="mt-2 text-(--ssz-text-secondary)">
          {t('create.done.summary', { schoolName, n: invitedCount })}
        </p>
      </div>

      <Button ref={ctaRef} size="lg" onClick={onGoToDashboard}>
        {t('create.finishCta')}
      </Button>

      <div className="w-full max-w-2xl">
        <p className="mb-4 text-sm font-semibold text-(--ssz-text-muted) uppercase tracking-wide">
          {t('create.done.next.heading')}
        </p>
        <ul
          role="list"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left"
        >
          <NextStepCard
            icon={<BookOpenText className="h-5 w-5" />}
            title={t('create.done.next.course.title')}
            helper={t('create.done.next.course.help')}
            href="/school/content/new"
          />
          <NextStepCard
            icon={<Users className="h-5 w-5" />}
            title={t('create.done.next.members.title')}
            helper={t('create.done.next.members.help')}
            href="/school/students"
          />
          <NextStepCard
            icon={<Settings2 className="h-5 w-5" />}
            title={t('create.done.next.settings.title')}
            helper={t('create.done.next.settings.help')}
            href="/school/settings"
          />
        </ul>
      </div>
    </div>
  );
}
