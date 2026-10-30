'use client';

import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Textarea } from '@/components/ui/textarea';
import {
  MAX_LEARNING_GOALS,
  MAX_LEARNING_GOAL_LENGTH,
  formatLearningGoals,
  learningGoalsProblem,
  parseLearningGoals,
} from '../lib/learning-goals';
import { useUnsavedChanges } from '../hooks/use-unsaved-changes';
import { SaveStatusIndicator } from './save-status-indicator';
import { PanelSaveButton } from './panel-save-button';

/**
 * A container's learning goals, one per line — a module's in the structure inspector, a
 * course's («What you will learn») in the course settings. Saved on demand like the other
 * fields; after a save the text is rewritten the way the server keeps it — trimmed, without
 * blank lines — so what the author sees is what was stored.
 */
export function LearningGoalsField({
  value,
  onSave,
  label,
  hint,
}: {
  value: string[];
  onSave: (goals: string[]) => Promise<void>;
  /** Defaults to the module's wording. */
  label?: string;
  hint?: string;
}) {
  const t = useTranslations('Authoring');
  const hintId = useId();
  const [draft, setDraft] = useState(() => formatLearningGoals(value));
  const goals = parseLearningGoals(draft);
  const problem = learningGoalsProblem(goals);
  const unsaved = useUnsavedChanges({
    onSave: async () => {
      // The button's own toast reports the failure; the reason is already on screen.
      if (learningGoalsProblem(goals)) throw new Error(problem ?? 'invalid');
      await onSave(goals);
      setDraft(formatLearningGoals(goals));
    },
  });
  const fieldLabel = label ?? t('structure.learningGoals');

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {fieldLabel}
      </span>
      <Textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          unsaved.markDirty();
        }}
        aria-label={fieldLabel}
        aria-invalid={problem !== null}
        aria-describedby={hintId}
        placeholder={t('structure.learningGoalsPlaceholder')}
        rows={3}
        className="text-sm"
      />
      <p
        id={hintId}
        className={problem ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}
      >
        {problem === 'tooMany'
          ? t('structure.learningGoalsTooMany', { max: MAX_LEARNING_GOALS })
          : problem === 'tooLong'
            ? t('structure.learningGoalsTooLong', { max: MAX_LEARNING_GOAL_LENGTH })
            : (hint ?? t('structure.learningGoalsHint'))}
      </p>
      <div className="flex items-center justify-between gap-2">
        <SaveStatusIndicator status={unsaved.status} savedAt={unsaved.savedAt} />
        <PanelSaveButton
          unsaved={unsaved}
          label={t('structure.saveLearningGoals')}
          successMessage={t('structure.learningGoalsSaved')}
        />
      </div>
    </div>
  );
}
