'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

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
import { TEMPLATE_CODE } from '@/lib/shared-kernel/wordbank-gapfill';

import { createLessonAction } from '../actions/lesson';
import { createVocabularyListAction } from '../actions/vocabulary';
import { createGrammarRuleAction } from '../actions/grammar';
import { createExerciseAction } from '../actions/exercise';
import { createGapFillAction } from '../actions/gap-fill';
import { assignItemSectionAction } from '../actions/container-item';
import { minimalExerciseValues } from '../lib/exercise-content';
import { CREATABLE_EXERCISE_TYPES, type CreatableExerciseType } from '../schemas/exercise';

interface AddLessonPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The target module's own container id — items attach to its draft version. */
  moduleContainerId: string;
  /**
   * Section to file the new item under. Creating an item never assigns one, so
   * without this everything lands ungrouped — fine when the picker is opened
   * from a module row, wrong when it is opened from inside a named section.
   */
  sectionId?: string | null;
  targetLanguage: string;
  difficultyLevel: DifficultyLevel;
  visibility: Visibility;
  /** Names the section in the dialog, so a section-scoped ＋ says where its material will land. */
  sectionTitle?: string | null;
  /** The course's owning school — required for `school_private` material. */
  ownerSchoolId?: string | null;
  /** Called after the draft item is created, so the caller can refetch the tree and select it. */
  onCreated: (itemId: string) => void;
}

const LESSON_KINDS: readonly LessonKind[] = ['text', 'video', 'audio', 'live'];

function isLessonKind(kind: MaterialKind): kind is LessonKind {
  return (LESSON_KINDS as readonly MaterialKind[]).includes(kind);
}

/**
 * Reading material, in the order an author builds a sub-lesson: new words, then
 * the text and its recordings, then the grammar behind it. `exercise` is absent
 * because exercises are offered by template in their own group — picking
 * "exercise" and then a template was a step that asked a question the author
 * had already answered.
 */
const MATERIAL_GROUP: readonly MaterialKind[] = MATERIAL_KINDS.filter((k) => k !== 'exercise');

export function AddLessonPicker({
  open,
  onOpenChange,
  moduleContainerId,
  sectionId,
  sectionTitle,
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
  const [pendingTemplate, setPendingTemplate] = useState<CreatableExerciseType | null>(null);
  function reset() {
    setPendingKind(null);
    setPendingTemplate(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handlePick(kind: MaterialKind) {
    if (isPending) return;
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
      await finish(result);
    });
  }

  /** Second step: create the exercise on the template the author picked. */
  function handlePickTemplate(templateCode: CreatableExerciseType) {
    if (isPending) return;
    setPendingTemplate(templateCode);
    const prompt = t('addLesson.defaultTitle', {
      type: tContent(`materialType.exercise` as 'materialType.text'),
    });
    const instructions = t('addLesson.defaultInstructions');

    startTransition(async () => {
      // Gap-fill is not a shape of the generic exercise form — it has its own builder
      // and its own document — so it is created from its own scaffold.
      const result =
        templateCode === TEMPLATE_CODE
          ? await createGapFillAction(
              moduleContainerId,
              targetLanguage,
              difficultyLevel,
              visibility,
              instructions,
              ownerSchoolId,
            )
          : await createExerciseAction(
              moduleContainerId,
              targetLanguage,
              difficultyLevel,
              visibility,
              minimalExerciseValues(templateCode, prompt, instructions),
              ownerSchoolId,
            );

      setPendingTemplate(null);
      await finish(result);
    });
  }

  /** Shared tail of both steps: report, close, and hand the new item to the caller. */
  async function finish(result: Result<{ itemId?: string }>) {
    if (!result.ok) {
      toast.error(tErrors(result.error.code));
      return;
    }
    if (!result.value.itemId) {
      toast.error(tErrors('unknown'));
      return;
    }
    // The item exists either way; a failed filing is worth a toast, not a
    // rollback — the author can move it with the section select.
    if (sectionId) {
      const assigned = await assignItemSectionAction(
        moduleContainerId,
        result.value.itemId,
        sectionId,
      );
      if (!assigned.ok) toast.error(tErrors(assigned.error.code));
    }
    reset();
    onOpenChange(false);
    onCreated(result.value.itemId);
  }

  const exerciseDef = getLessonTypeDefinition('exercise');
  const ExerciseIcon = exerciseDef.icon;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('addLesson.title')}</DialogTitle>
          <DialogDescription>
            {sectionTitle
              ? t('addLesson.intoSection', { section: sectionTitle })
              : t('addLesson.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          <section>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('addLesson.groupMaterial')}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MATERIAL_GROUP.map((kind) => {
                const def = getLessonTypeDefinition(kind);
                const Icon = def.icon;
                return (
                  <PickerCard
                    key={kind}
                    label={tContent(`materialType.${kind}` as 'materialType.text')}
                    hueVar={def.hueVar}
                    icon={<Icon size={16} style={{ color: `var(${def.hueVar})` }} />}
                    disabled={isPending}
                    busy={pendingKind === kind}
                    onClick={() => handlePick(kind)}
                  />
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('addLesson.groupExercises')}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CREATABLE_EXERCISE_TYPES.map((code) => (
                <PickerCard
                  key={code}
                  label={tExercises(`types.${code}`)}
                  hueVar={exerciseDef.hueVar}
                  icon={<ExerciseIcon size={16} style={{ color: `var(${exerciseDef.hueVar})` }} />}
                  disabled={isPending}
                  busy={pendingTemplate === code}
                  onClick={() => handlePickTemplate(code)}
                />
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PickerCard({
  label,
  hueVar,
  icon,
  disabled,
  busy,
  onClick,
}: {
  label: string;
  hueVar: string;
  icon: React.ReactNode;
  disabled: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md"
        style={{ background: `color-mix(in oklch, var(${hueVar}) 16%, transparent)` }}
      >
        {icon}
      </span>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {busy && <span className="ml-auto text-xs text-muted-foreground">…</span>}
    </button>
  );
}
