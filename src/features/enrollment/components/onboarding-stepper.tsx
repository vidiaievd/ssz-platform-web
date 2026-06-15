'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';

import { onboardingSteps, resolveNextStatus } from '@/lib/enrollment/status';
import { resolvePlacement } from '@/features/enrollment/lib/resolve-placement';
import { PlacementTest } from '@/features/enrollment/components/placement-test';
import { AvailabilityStep } from '@/features/enrollment/components/availability-step';
import { InterviewBookingStep } from '@/features/enrollment/components/interview-booking-step';
import type { PlacementQuestion } from '@/features/enrollment/components/placement-test';
import type { Membership, SchoolOnboardingSettings, PlacementResult } from '@/features/enrollment/types';
import type { ISODate } from '@/features/groups/types';

// Fixture questions until scheduling service provides them.
const FIXTURE_QUESTIONS: PlacementQuestion[] = [
  {
    id: 'q1',
    text: 'Hva heter du?',
    options: [
      { id: 'a', text: 'Jeg heter Maria.' },
      { id: 'b', text: 'Jeg er Maria.' },
      { id: 'c', text: 'Mitt navn er Maria.' },
      { id: 'd', text: 'All of the above are correct.' },
    ],
    correctId: 'd',
    weight: 1,
  },
  {
    id: 'q2',
    text: 'Velg riktig form: "Han ___ til jobben hver dag."',
    options: [
      { id: 'a', text: 'går' },
      { id: 'b', text: 'gå' },
      { id: 'c', text: 'gikk' },
      { id: 'd', text: 'gående' },
    ],
    correctId: 'a',
    weight: 2,
  },
  {
    id: 'q3',
    text: 'Which sentence uses the subjunctive mood correctly?',
    options: [
      { id: 'a', text: 'Hvis jeg var rik, ville jeg reise verden rundt.' },
      { id: 'b', text: 'Hvis jeg er rik, vil jeg reise verden rundt.' },
      { id: 'c', text: 'Hvis jeg er rik, ville jeg reise verden rundt.' },
      { id: 'd', text: 'Hvis jeg var rik, vil jeg reise verden rundt.' },
    ],
    correctId: 'a',
    weight: 3,
  },
];

type Props = {
  membership: Membership;
  settings: SchoolOnboardingSettings;
  platformResults: PlacementResult[];
  today: ISODate;
};

export function OnboardingStepper({ membership, settings, platformResults, today }: Props) {
  const t = useTranslations('Enrollment.Onboarding');
  const tPlacement = useTranslations('Enrollment.PlacementTest');
  const router = useRouter();

  const steps = onboardingSteps(settings);
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const stepContentRef = useRef<HTMLDivElement>(null);
  const prevStepIndex = useRef(stepIndex);

  useEffect(() => {
    if (stepIndex !== prevStepIndex.current) {
      prevStepIndex.current = stepIndex;
      stepContentRef.current?.focus();
    }
  }, [stepIndex]);

  const placementDecision = resolvePlacement(
    platformResults,
    membership.language,
    settings,
    today,
  );

  async function advanceOrFinish() {
    const next = stepIndex + 1;
    if (next >= steps.length) {
      await finish();
    } else {
      setStepIndex(next);
    }
  }

  async function finish() {
    const nextStatus = resolveNextStatus(membership, settings);
    try {
      const res = await fetch(`/api/enrollment/memberships/${membership.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: nextStatus }),
      });
      if (!res.ok) throw new Error('Transition failed');
      setDone(true);
    } catch {
      toast.error(t('finishFailed'));
    }
  }

  async function handlePlacementComplete({
    score,
    cefrLevel,
  }: {
    score: number;
    cefrLevel: import('@/features/groups/types').CEFR;
  }) {
    const scope = settings.placement.mode === 'school' ? 'membership' : 'platform';
    const endpoint =
      scope === 'platform'
        ? '/api/enrollment/platform-placement'
        : `/api/enrollment/memberships/${membership.id}/placement`;

    const body =
      scope === 'platform'
        ? { language: membership.language, score, cefrLevel }
        : {
            language: membership.language,
            cefrLevel,
            score,
            takenAt: today,
            scope,
            sourceLabel: scope === 'membership' ? 'school' : 'platform',
          };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(tPlacement('saveFailed'));
    toast.success(tPlacement('resultSaved', { level: cefrLevel }));
    await advanceOrFinish();
  }

  if (done) {
    const nextStatus = resolveNextStatus(membership, settings);
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <h2 className="text-xl font-semibold text-(--ssz-text-primary)">
          {t('allDoneTitle')}
        </h2>
        <p className="max-w-sm text-sm text-(--ssz-text-secondary)">
          {nextStatus === 'placement-review'
            ? t('allDoneReview')
            : t('allDoneActive')}
        </p>
        <button
          onClick={() => router.push('/student/dashboard')}
          className="mt-4 rounded-lg bg-(--ssz-primary) px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {t('goToDashboard')}
        </button>
      </div>
    );
  }

  if (steps.length === 0) {
    // No onboarding steps — auto-finish immediately
    void finish();
    return null;
  }

  // Skip placement if platform result can be reused
  const currentStep = steps[stepIndex];
  if (currentStep === 'placement' && placementDecision.action === 'reuse') {
    // Fast-path: reuse existing result and move on
    void advanceOrFinish();
    return null;
  }

  const stepLabel = (s: (typeof steps)[number]) => {
    if (s === 'placement') return t('stepPlacement');
    if (s === 'availability') return t('stepAvailability');
    return t('stepInterview');
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Progress indicator */}
      {steps.length > 1 && (
        <ol className="flex items-center gap-3" aria-label={t('stepsLabel')}>
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span
                aria-current={i === stepIndex ? 'step' : undefined}
                aria-label={`${t('stepNumber', { n: i + 1 })}: ${stepLabel(s)}${i < stepIndex ? ` (${t('stepDone')})` : ''}`}
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                  i < stepIndex
                    ? 'bg-green-500 text-white'
                    : i === stepIndex
                      ? 'bg-(--ssz-primary) text-white'
                      : 'bg-border text-(--ssz-text-muted)',
                ].join(' ')}
              >
                {i < stepIndex ? '✓' : i + 1}
              </span>
              <span
                className={[
                  'text-sm',
                  i === stepIndex
                    ? 'font-medium text-(--ssz-text-primary)'
                    : 'text-(--ssz-text-muted)',
                ].join(' ')}
                aria-hidden="true"
              >
                {stepLabel(s)}
              </span>
              {i < steps.length - 1 && (
                <span className="mx-1 text-(--ssz-text-muted)" aria-hidden="true">›</span>
              )}
            </li>
          ))}
        </ol>
      )}

      {/* Step content — tabIndex=-1 so focus() works without showing an outline */}
      <div ref={stepContentRef} tabIndex={-1} className="outline-none">
      {currentStep === 'placement' && (
        <PlacementTest
          language={membership.language}
          questions={FIXTURE_QUESTIONS}
          onComplete={handlePlacementComplete}
        />
      )}

      {currentStep === 'availability' && (
        <AvailabilityStep
          membershipId={membership.id}
          onComplete={advanceOrFinish}
        />
      )}

      {currentStep === 'interview' && (
        <InterviewBookingStep
          membershipId={membership.id}
          schoolSlug={membership.schoolSlug}
          onComplete={advanceOrFinish}
        />
      )}
      </div>
    </div>
  );
}
