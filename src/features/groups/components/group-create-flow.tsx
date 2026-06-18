'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Stepper } from '@/components/ui/stepper';
import { cn } from '@/lib/utils';
import { createGroup, updateSlots, assignTeacher, addStudents } from '../api/mutations';
import { useSchoolStudents } from '../api/use-student-candidates';
import { useGroupCreateWizardStore } from '../stores/create-wizard-store';
import { StepCourse } from './create/step-course';
import { StepDetails } from './create/step-details';
import { StepSchedule } from './create/step-schedule';
import { StepTeachers } from './create/step-teachers';
import { StepStudents } from './create/step-students';
import { StepReview } from './create/step-review';
import type { TimetableTeacher } from '../types';
import type { StudentCandidate } from '../api/queries';

const STEP_DEFS = [
  { id: 'course',    label: 'Course' },
  { id: 'details',   label: 'Details' },
  { id: 'schedule',  label: 'Schedule' },
  { id: 'teachers',  label: 'Teachers' },
  { id: 'students',  label: 'Students' },
  { id: 'review',    label: 'Review' },
] as const;

type TeacherMeta = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  maxWeeklyHours: number;
  langs: string[];
};

type Props = {
  schoolId: string;
  schoolSlug: string;
  locale: string;
  teachers: TeacherMeta[];
  timetable: TimetableTeacher[];
  students: StudentCandidate[];
};

export function GroupCreateFlow({ schoolId, schoolSlug, locale, teachers, timetable, students: initialStudents }: Props) {
  const router = useRouter();
  const { data: students } = useSchoolStudents(schoolId, { initialData: initialStudents });
  const [isPending, startTransition] = useTransition();
  const store = useGroupCreateWizardStore();
  const { currentStep, setStep, isStepValid, isSubmitting, submitError, setSubmitting, setSubmitError, reset } = store;
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void (async () => {
      store.initForSchool(schoolId);
      setHydrated(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  if (!hydrated) return null;

  const isLastStep = currentStep === STEP_DEFS.length - 1;
  const currentValid = isStepValid(currentStep);

  function handleBack() {
    if (currentStep > 0) setStep(currentStep - 1);
    else router.push(`/${locale}/school/${schoolSlug}/groups`);
  }

  function handleContinue() {
    if (!currentValid) return;
    if (isLastStep) {
      handleSubmit();
    } else {
      setStep(currentStep + 1);
    }
  }

  function handleSubmit() {
    setSubmitError(null);
    setSubmitting(true);
    startTransition(async () => {
      try {
        // 1. Create draft group
        const createResult = await createGroup(schoolId, {
          name: store.name,
          courseId: store.courseId ?? null,
          lang: store.lang,
          level: store.level,
          mode: store.mode,
          minCapacity: store.capacity.min,
          maxCapacity: store.capacity.max,
          ...(store.startDate && { startDate: store.startDate }),
          ...(store.endDate && { endDate: store.endDate }),
        });

        if (!createResult.ok || !createResult.id) {
          setSubmitError('Failed to create group. Please try again.');
          setSubmitting(false);
          return;
        }

        const groupId = createResult.id;

        // 2. Slots
        if (store.slots.length > 0) {
          await updateSlots(schoolId, groupId, store.slots.map((s) => ({
            day: s.day,
            start: s.start,
            end: s.end,
            room: s.room,
          })));
        }

        // 3. Teachers (primary first, then co-primary)
        const ordered = [...store.teachers].sort((a, b) =>
          a.role === 'primary' ? -1 : b.role === 'primary' ? 1 : 0,
        );
        for (const t of ordered) {
          await assignTeacher(schoolId, groupId, { userId: t.userId, role: t.role }, true);
        }

        // 4. Students
        if (store.studentIds.length > 0) {
          await addStudents(schoolId, groupId, store.studentIds, true);
        }

        toast.success('Group created as draft');
        reset(schoolId);
        router.push(`/${locale}/school/${schoolSlug}/groups/${groupId}`);
      } catch {
        setSubmitError('An unexpected error occurred. Please try again.');
        setSubmitting(false);
      }
    });
  }

  const currentStepLabel = STEP_DEFS[currentStep]?.label ?? '';

  return (
    <div className="flex flex-col gap-6">
      {/* Stepper */}
      <Stepper
        steps={[...STEP_DEFS]}
        currentStep={currentStep}
        onStepClick={(i) => {
          // Allow navigating to completed steps only
          if (i < currentStep) setStep(i);
        }}
      />

      {/* Step content */}
      <div className={cn('min-h-[320px]', isPending && 'opacity-50 pointer-events-none')}>
        {currentStep === 0 && <StepCourse />}
        {currentStep === 1 && <StepDetails />}
        {currentStep === 2 && <StepSchedule />}
        {currentStep === 3 && <StepTeachers teachers={teachers} timetable={timetable} />}
        {currentStep === 4 && <StepStudents students={students} />}
        {currentStep === 5 && <StepReview teachers={teachers} />}
      </div>

      {/* Submit error */}
      {submitError && (
        <p className="text-sm text-error-600" role="alert">{submitError}</p>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button variant="ghost" size="sm" onClick={handleBack} disabled={isSubmitting || isPending}>
          <ArrowLeft className="size-3.5 mr-1.5" aria-hidden="true" />
          {currentStep === 0 ? 'Cancel' : 'Back'}
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-(--ssz-text-muted) hidden sm:block">
            Step {currentStep + 1} of {STEP_DEFS.length} · {currentStepLabel}
          </span>
          <Button
            onClick={handleContinue}
            disabled={!currentValid || isSubmitting || isPending}
            size="sm"
          >
            {isLastStep ? (
              isSubmitting ? 'Creating…' : 'Create group'
            ) : (
              <>
                Continue
                <ArrowRight className="size-3.5 ml-1.5" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
