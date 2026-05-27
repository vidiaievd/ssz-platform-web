'use client';

import { useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import type { OnboardingRole } from '../../stores/onboarding-store';
import type { OnboardingProfileValues } from '../../schemas/onboarding';
import type { OnboardingStep } from './step-indicator';
import { StepIndicator } from './step-indicator';
import { StepProfile } from './step-profile';
import { StepPrefs } from './step-prefs';
import { StepTutor } from './step-tutor';

const STEP_ORDER: OnboardingStep[] = ['profile', 'prefs'];

function resolveStep(raw: string | null): OnboardingStep {
  if (raw === 'prefs') return 'prefs';
  return 'profile';
}

type OnboardingShellProps = {
  role: OnboardingRole;
  initialProfileValues: OnboardingProfileValues;
};

export function OnboardingShell({ role, initialProfileValues }: OnboardingShellProps) {
  const t = useTranslations('Onboarding');
  const searchParams = useSearchParams();
  const currentStep = resolveStep(searchParams.get('step'));
  const currentIdx = STEP_ORDER.indexOf(currentStep);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [currentStep]);

  const progressLabel = t('progress.label', { current: currentIdx + 1, total: STEP_ORDER.length });

  const prefsStep = role === 'tutor'
    ? <StepTutor headingRef={headingRef} />
    : <StepPrefs headingRef={headingRef} />;

  return (
    <>
      {/* Skip-link for keyboard users */}
      <a
        href="#onboarding-form"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:underline"
      >
        {t('skipToForm')}
      </a>

      {/* Desktop: centered card */}
      <div className="hidden md:block max-w-2xl mx-auto my-12">
        <div className="rounded-[var(--ssz-radius-xl)] border bg-(--ssz-bg-surface) shadow-[var(--ssz-shadow-md)]">
          <div className="px-8 pt-8 pb-2">
            <div className="flex items-center justify-between mb-6">
              <StepIndicator currentStep={currentStep} progressLabel={progressLabel} />
              <span className="text-xs text-(--ssz-text-muted)">{progressLabel}</span>
            </div>
          </div>
          <div id="onboarding-form" className="px-8 pb-10">
            {currentStep === 'profile' && (
              <StepProfile initialValues={initialProfileValues} headingRef={headingRef} />
            )}
            {currentStep === 'prefs' && prefsStep}
          </div>
        </div>
      </div>

      {/* Mobile: full-bleed */}
      <div className="flex flex-col min-h-dvh md:hidden">
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between">
            <StepIndicator currentStep={currentStep} progressLabel={progressLabel} />
            <span className="text-xs text-(--ssz-text-muted)">{progressLabel}</span>
          </div>
        </div>
        <div id="onboarding-form" className="flex-1 overflow-y-auto px-4 py-6">
          {currentStep === 'profile' && (
            <StepProfile initialValues={initialProfileValues} headingRef={headingRef} />
          )}
          {currentStep === 'prefs' && prefsStep}
        </div>
      </div>
    </>
  );
}
