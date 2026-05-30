'use client';

import { useRef, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';

import { useRouter } from '@/lib/i18n/navigation';
import { generateSlug } from '@/lib/utils/slug';
import { LogoutButton } from '@/features/auth/components/logout-button';
import { LanguageSwitcher } from '@/components/shared/language-switcher';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import type { OnboardingRole } from '../../stores/onboarding-store';
import { useOnboardingStore } from '../../stores/onboarding-store';
import type { OnboardingProfileValues } from '../../schemas/onboarding';
import type { OnboardingStep } from './step-indicator';
import { StepIndicator } from './step-indicator';
import { StepProfile } from './step-profile';
import { StepPrefs } from './step-prefs';
import { StepTutor } from './step-tutor';

const STEP_ORDER: OnboardingStep[] = ['profile', 'prefs'];

type OnboardingShellProps = {
  role: OnboardingRole;
  initialProfileValues: OnboardingProfileValues;
};

export function OnboardingShell({ role, initialProfileValues }: OnboardingShellProps) {
  const t = useTranslations('Onboarding');
  const tUser = useTranslations('UserMenu');
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('profile');
  const currentIdx = STEP_ORDER.indexOf(currentStep);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const profileDraft = useOnboardingStore((s) => s.profileDraft);

  useEffect(() => {
    headingRef.current?.focus();
  }, [currentStep]);

  const progressLabel = t('progress.label', { current: currentIdx + 1, total: STEP_ORDER.length });

  function goToPrefs() {
    setCurrentStep('prefs');
  }

  function goToProfile() {
    setCurrentStep('profile');
  }

  function handleDoneStudent() {
    router.replace('/student/dashboard');
  }

  function handleDoneTutor() {
    router.replace(`/tutor/${generateSlug(profileDraft.displayName)}/dashboard`);
  }

  const prefsStep =
    role === 'tutor' ? (
      <StepTutor headingRef={headingRef} onBack={goToProfile} onDone={handleDoneTutor} />
    ) : (
      <StepPrefs headingRef={headingRef} onBack={goToProfile} onDone={handleDoneStudent} />
    );

  return (
    <>
      {/* Skip-link for keyboard users */}
      <a
        href="#onboarding-form"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:underline"
      >
        {t('skipToForm')}
      </a>

      {/* Page header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-(--ssz-border-base)">
        <span className="text-sm font-semibold text-(--ssz-text-primary) md:hidden">SSZ</span>
        <span className="hidden md:block text-sm font-semibold text-(--ssz-text-primary) mx-auto">SSZ</span>
        <div className="flex items-center gap-1 md:absolute md:right-4 md:top-3">
          <LanguageSwitcher />
          <ThemeToggle />
          <LogoutButton variant="ghost" size="icon" aria-label={tUser('signOut')}>
            <LogOut className="size-4" />
          </LogoutButton>
        </div>
      </header>

      {/* Single render — responsive layout via classes */}
      <div className="flex flex-col flex-1 md:block md:max-w-2xl md:mx-auto md:my-12">
        <div className="flex flex-col flex-1 md:flex-none md:rounded-(--ssz-radius-xl) md:border md:bg-surface md:shadow-(--ssz-shadow-md)">
          <div className="px-4 pt-4 pb-2 md:px-8 md:pt-8 md:pb-0">
            <div className="flex items-center justify-between md:mb-6">
              <StepIndicator currentStep={currentStep} progressLabel={progressLabel} />
              <span className="text-xs text-(--ssz-text-muted)">{progressLabel}</span>
            </div>
          </div>
          <div id="onboarding-form" className="flex-1 px-4 py-6 md:px-8 md:pb-10">
            {currentStep === 'profile' && (
              <StepProfile initialValues={initialProfileValues} headingRef={headingRef} onNext={goToPrefs} />
            )}
            {currentStep === 'prefs' && prefsStep}
          </div>
        </div>
      </div>
    </>
  );
}
