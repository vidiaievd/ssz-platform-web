'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { GraduationCap, Users, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { OnboardingRole } from '../../stores/onboarding-store';
import { useOnboardingStore } from '../../stores/onboarding-store';

type StepRoleProps = {
  initialRole: OnboardingRole;
  headingRef?: React.RefObject<HTMLHeadingElement | null>;
};

export function StepRole({ initialRole, headingRef }: StepRoleProps) {
  const t = useTranslations('Onboarding');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setRole = useOnboardingStore((s) => s.setRole);
  const [selected, setSelected] = useState<OnboardingRole>(initialRole);

  const studentRef = useRef<HTMLButtonElement>(null);
  const tutorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole, setRole]);

  function handleSelect(role: OnboardingRole) {
    setSelected(role);
    setRole(role);
  }

  function handleKeyDown(e: React.KeyboardEvent, role: OnboardingRole) {
    const isArrow = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(e.key);
    if (!isArrow) return;
    e.preventDefault();
    const other: OnboardingRole = role === 'student' ? 'tutor' : 'student';
    handleSelect(other);
    (other === 'student' ? studentRef : tutorRef).current?.focus();
  }

  function handleNext() {
    startTransition(() => {
      router.push('?step=profile');
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl font-semibold text-(--ssz-text-primary) focus:outline-none"
        >
          {t('step.role.title')}
        </h1>
        <p className="mt-2 text-(--ssz-text-secondary) leading-relaxed">{t('step.role.subtitle')}</p>
      </div>

      <div role="radiogroup" aria-label={t('step.role.title')} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          ref={studentRef}
          type="button"
          role="radio"
          aria-checked={selected === 'student'}
          aria-describedby="role-help-student"
          disabled={isPending}
          tabIndex={selected === 'student' ? 0 : -1}
          onClick={() => handleSelect('student')}
          onKeyDown={(e) => handleKeyDown(e, 'student')}
          className={cn(
            'relative flex flex-col items-start gap-3 rounded-lg border-2 p-6 text-left cursor-pointer',
            'transition-colors duration-[var(--ssz-duration-base)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected === 'student'
              ? 'border-[var(--ssz-color-primary-600)] bg-[var(--ssz-color-primary-50)]'
              : 'border-(--ssz-border-default) hover:bg-(--ssz-bg-subtle)',
          )}
        >
          {selected === 'student' && (
            <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ssz-color-primary-600)]">
              <Check className="h-3 w-3 text-white" />
            </span>
          )}
          <GraduationCap
            className={cn(
              'h-7 w-7',
              selected === 'student' ? 'text-[var(--ssz-color-primary-600)]' : 'text-(--ssz-text-secondary)',
            )}
          />
          <div>
            <p className="font-semibold text-(--ssz-text-primary)">{t('step.role.student.title')}</p>
            <p id="role-help-student" className="mt-1 text-sm text-(--ssz-text-secondary)">
              {t('step.role.student.help')}
            </p>
          </div>
        </button>

        <button
          ref={tutorRef}
          type="button"
          role="radio"
          aria-checked={selected === 'tutor'}
          aria-describedby="role-help-tutor"
          disabled={isPending}
          tabIndex={selected === 'tutor' ? 0 : -1}
          onClick={() => handleSelect('tutor')}
          onKeyDown={(e) => handleKeyDown(e, 'tutor')}
          className={cn(
            'relative flex flex-col items-start gap-3 rounded-lg border-2 p-6 text-left cursor-pointer',
            'transition-colors duration-[var(--ssz-duration-base)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            selected === 'tutor'
              ? 'border-[var(--ssz-color-primary-600)] bg-[var(--ssz-color-primary-50)]'
              : 'border-(--ssz-border-default) hover:bg-(--ssz-bg-subtle)',
          )}
        >
          {selected === 'tutor' && (
            <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ssz-color-primary-600)]">
              <Check className="h-3 w-3 text-white" />
            </span>
          )}
          <Users
            className={cn(
              'h-7 w-7',
              selected === 'tutor' ? 'text-[var(--ssz-color-primary-600)]' : 'text-(--ssz-text-secondary)',
            )}
          />
          <div>
            <p className="font-semibold text-(--ssz-text-primary)">{t('step.role.tutor.title')}</p>
            <p id="role-help-tutor" className="mt-1 text-sm text-(--ssz-text-secondary)">
              {t('step.role.tutor.help')}
            </p>
          </div>
        </button>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleNext} disabled={!selected || isPending} loading={isPending}>
          {t('next')}
        </Button>
      </div>
    </div>
  );
}
