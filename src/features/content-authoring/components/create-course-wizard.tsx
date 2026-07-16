'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Stepper, type StepDef } from '@/components/ui/stepper';
import { Link } from '@/lib/i18n/navigation';

import { useCreateCourseFlow } from '../hooks/use-create-course-flow';
import { useCreateCourseStore } from '../stores/create-course';
import { StepBasics } from './create-course-steps/step-basics';
import { StepLevels } from './create-course-steps/step-levels';
import { StepStarter } from './create-course-steps/step-starter';
import { CourseLivePreview } from './create-course-steps/course-live-preview';

const TOTAL_STEPS = 3;

/** Guided 3-step wizard (Basics → Levels → Starter) with a sticky live preview. Creation happens once, on the final step. */
export function CreateCourseWizard() {
  const t = useTranslations('Authoring.createCourse');
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const contentBase = `/school/${schoolSlug}/content`;

  const store = useCreateCourseStore();
  const { create, isCreating, canCreate } = useCreateCourseFlow();

  const steps: StepDef[] = [
    { id: 'basics', label: t('steps.basics') },
    { id: 'levels', label: t('steps.levels') },
    { id: 'starter', label: t('steps.starter') },
  ];

  const isFirstStep = store.step === 0;
  const isLastStep = store.step === TOTAL_STEPS - 1;
  const canAdvance = store.step === 0 ? canCreate : true;

  function handleNext() {
    if (isLastStep) {
      create();
      return;
    }
    store.setStep(store.step + 1);
  }

  function handleBack() {
    store.setStep(store.step - 1);
  }

  return (
    <div className="grid grid-cols-1 gap-7 lg:grid-cols-[1fr_300px] lg:items-start">
      <div>
        <div className="mb-6">
          <Stepper steps={steps} currentStep={store.step} onStepClick={(i) => i < store.step && store.setStep(i)} />
        </div>

        {store.step === 0 && <StepBasics />}
        {store.step === 1 && <StepLevels />}
        {store.step === 2 && <StepStarter />}

        <div className="mt-6 flex items-center justify-between border-t border-(--ssz-border-default) pt-4.5">
          {isFirstStep ? (
            <Button variant="ghost" asChild>
              <Link href={contentBase} onClick={() => store.reset()}>
                {t('cancel')}
              </Link>
            </Button>
          ) : (
            <Button variant="ghost" onClick={handleBack} disabled={isCreating}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {t('back')}
            </Button>
          )}

          <Button onClick={handleNext} disabled={!canAdvance || isCreating} loading={isCreating}>
            {isLastStep ? (
              <>
                <Check className="mr-1.5 h-4 w-4" />
                {t('create')}
              </>
            ) : (
              <>
                {t('continue')}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="hidden lg:sticky lg:top-0 lg:block">
        <CourseLivePreview />
      </div>
    </div>
  );
}
