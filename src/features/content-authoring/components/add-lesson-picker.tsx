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
import { MATERIAL_KINDS, getLessonTypeDefinition, type MaterialKind } from '@/lib/content/lesson-types';
import type { DifficultyLevel, LessonKind, Visibility } from '@/features/content/types';

import { createLessonAction } from '../actions/lesson';
import { createVocabularyListAction } from '../actions/vocabulary';
import { createGrammarRuleAction } from '../actions/grammar';
import { createExerciseAction } from '../actions/exercise';
import { exerciseFormSchema } from '../schemas/exercise';

interface AddLessonPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The target module's own container id — items attach to its draft version. */
  moduleContainerId: string;
  targetLanguage: string;
  difficultyLevel: DifficultyLevel;
  visibility: Visibility;
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
  onCreated,
}: AddLessonPickerProps) {
  const t = useTranslations('Authoring');
  const tContent = useTranslations('Content');
  const tErrors = useTranslations('Errors');
  const [isPending, startTransition] = useTransition();
  const [pendingKind, setPendingKind] = useState<MaterialKind | null>(null);

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
          );
        }
        if (kind === 'vocab') {
          return createVocabularyListAction(
            moduleContainerId,
            targetLanguage,
            difficultyLevel,
            visibility,
            { title },
          );
        }
        if (kind === 'grammar') {
          return createGrammarRuleAction(
            moduleContainerId,
            targetLanguage,
            difficultyLevel,
            visibility,
            { title },
          );
        }
        // exercise: no title-only creation — scaffold a minimal valid multiple-choice draft.
        const parsed = exerciseFormSchema.parse({
          templateCode: 'multiple_choice',
          mcQuestion: title,
          mcOptions: [{ text: 'Option 1' }, { text: 'Option 2' }],
          mcCorrectIndex: 0,
        });
        return createExerciseAction(moduleContainerId, targetLanguage, parsed);
      })();

      setPendingKind(null);

      if (!result.ok) {
        toast.error(tErrors(result.error.code));
        return;
      }
      if (!result.value.itemId) {
        toast.error(tErrors('unknown'));
        return;
      }
      onOpenChange(false);
      onCreated(result.value.itemId);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
