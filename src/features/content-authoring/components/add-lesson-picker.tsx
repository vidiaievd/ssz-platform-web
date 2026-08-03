'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MATERIAL_KINDS,
  getLessonTypeDefinition,
  type MaterialKind,
} from '@/lib/content/lesson-types';
import type { Result } from '@/lib/result';
import type { DifficultyLevel, LessonKind, Visibility } from '@/features/content/types';

import { createLessonAction } from '../actions/lesson';
import { createVocabularyListAction } from '../actions/vocabulary';
import { createGrammarRuleAction } from '../actions/grammar';
import { createExerciseAction } from '../actions/exercise';
import { minimalExerciseValues } from '../lib/exercise-content';
import { EXERCISE_TYPES, type ExerciseType } from '../schemas/exercise';

interface AddLessonPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The target module's own container id — items attach to its draft version. */
  moduleContainerId: string;
  targetLanguage: string;
  difficultyLevel: DifficultyLevel;
  visibility: Visibility;
  /** The course's owning school — required for `school_private` material. */
  ownerSchoolId?: string | null;
  /** Called after the draft item is created, so the caller can refetch the tree and select it. */
  onCreated: (itemId: string) => void;
}

const LESSON_KINDS: readonly LessonKind[] = ['text', 'video', 'audio', 'live'];

function isLessonKind(kind: MaterialKind): kind is LessonKind {
  return (LESSON_KINDS as readonly MaterialKind[]).includes(kind);
}

export function AddLessonPicker({
  open,
  onOpenChange,
  moduleContainerId,
  targetLanguage,
  difficultyLevel,
  visibility,
  ownerSchoolId,
  onCreated,
}: AddLessonPickerProps) {
  const t = useTranslations('Authoring');
  const tContent = useTranslations('Content');
  const tExercises = useTranslations('Authoring.exercises');
  const tErrors = useTranslations('Errors');
  const [isPending, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<MaterialKind | null>(null);
  /* An exercise can't be created from a title alone: its shape depends on the
     template, and the template is immutable once the backend has bound it. So
     picking "exercise" opens a second step rather than creating anything. */
  const [pendingTemplate, setPendingTemplate] = useState<ExerciseType | null>(null);
  const [choosingTemplate, setChoosingTemplate] = useState(false);

  function reset() {
    setChoosingTemplate(false);
    setPendingKind(null);
    setPendingTemplate(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handlePick(kind: MaterialKind) {
    if (isPending) return;
    if (kind === 'exercise') {
      setChoosingTemplate(true);
      return;
    }
    setPendingKind(kind);
    const title = t('addLesson.defaultTitle', {
      type: tContent(`materialType.${kind}` as 'materialType.text'),
    });

    startTransition(async () => {
      const result = await (async () => {
        if (isLessonKind(kind)) {
          return createLessonAction(
            moduleContainerId,
            targetLanguage,
            difficultyLevel,
            visibility,
            { title },
            kind,
            ownerSchoolId,
          );
        }
        if (kind === 'vocab') {
          return createVocabularyListAction(
            moduleContainerId,
            targetLanguage,
            difficultyLevel,
            visibility,
            { title },
            ownerSchoolId,
          );
        }
        if (kind === 'grammar') {
          return createGrammarRuleAction(
            moduleContainerId,
            targetLanguage,
            difficultyLevel,
            visibility,
            { title },
            ownerSchoolId,
          );
        }
        throw new Error(`Unhandled material kind: ${kind}`);
      })();

      setPendingKind(null);
      finish(result);
    });
  }

  /** Second step: create the exercise on the template the author picked. */
  function handlePickTemplate(templateCode: ExerciseType) {
    if (isPending) return;
    setPendingTemplate(templateCode);
    const prompt = t('addLesson.defaultTitle', {
      type: tContent(`materialType.exercise` as 'materialType.text'),
    });

    startTransition(async () => {
      const result = await createExerciseAction(
        moduleContainerId,
        targetLanguage,
        difficultyLevel,
        visibility,
        minimalExerciseValues(templateCode, prompt, t('addLesson.defaultInstructions')),
        ownerSchoolId,
      );

      setPendingTemplate(null);
      finish(result);
    });
  }

  /** Shared tail of both steps: report, close, and hand the new item to the caller. */
  function finish(result: Result<{ itemId?: string }>) {
    if (!result.ok) {
      toast.error(tErrors(result.error.code));
      return;
    }
    if (!result.value.itemId) {
      toast.error(tErrors('unknown'));
      return;
    }
    reset();
    onOpenChange(false);
    onCreated(result.value.itemId);
  }

  if (choosingTemplate) {
    const exerciseDef = getLessonTypeDefinition('exercise');
    const ExerciseIcon = exerciseDef.icon;

    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('addLesson.exerciseTypeTitle')}</DialogTitle>
            <DialogDescription>{t('addLesson.exerciseTypeDescription')}</DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[60vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {EXERCISE_TYPES.map((code) => (
              <button
                key={code}
                type="button"
                disabled={isPending}
                onClick={() => handlePickTemplate(code)}
                className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-subtle disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                  style={{
                    background: `color-mix(in oklch, var(${exerciseDef.hueVar}) 16%, transparent)`,
                  }}
                >
                  <ExerciseIcon size={16} style={{ color: `var(${exerciseDef.hueVar})` }} />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {tExercises(`types.${code}`)}
                </span>
                {isPending && pendingTemplate === code && (
                  <span className="ml-auto text-xs text-muted-foreground">…</span>
                )}
              </button>
            ))}
          </div>

          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => setChoosingTemplate(false)}
            >
              <ChevronLeft className="mr-1.5 h-4 w-4" />
              {t('addLesson.back')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('addLesson.title')}</DialogTitle>
          <DialogDescription>{t('addLesson.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2.5">
          {MATERIAL_KINDS.map((kind) => {
            const def = getLessonTypeDefinition(kind);
            const Icon = def.icon;
            return (
              <button
                key={kind}
                type="button"
                disabled={isPending}
                onClick={() => handlePick(kind)}
                className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-subtle disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
                  style={{ background: `color-mix(in oklch, var(${def.hueVar}) 16%, transparent)` }}
                >
                  <Icon size={16} style={{ color: `var(${def.hueVar})` }} />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {tContent(`materialType.${kind}` as 'materialType.text')}
                </span>
                {isPending && pendingKind === kind && (
                  <span className="ml-auto text-xs text-muted-foreground">…</span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
