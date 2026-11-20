'use client';

import { useTranslations } from 'next-intl';

import { useRouter } from '@/lib/i18n/navigation';
import { formatLearningGoals } from '../lib/learning-goals';
import { setContainerLearningGoalsAction } from '../actions/container';
import { LearningGoalsField } from './learning-goals-field';
import { SaveRefusedError } from '../hooks/use-unsaved-changes';

/**
 * A course's own learning goals — what the catalogue shows as «What you will learn» before a
 * learner enrols (VoxOrd plan 04, step 9b). Units keep their own goals in the structure
 * inspector; these are the course's few lines above them.
 */
export function CourseLearningGoalsField({
  containerId,
  goals,
}: {
  containerId: string;
  goals: string[];
}) {
  const t = useTranslations('Authoring');
  const router = useRouter();

  return (
    <LearningGoalsField
      // Keyed by what the server holds, so a refresh after the save resets the field to it.
      key={formatLearningGoals(goals)}
      value={goals}
      label={t('structure.courseLearningGoals')}
      hint={t('structure.courseLearningGoalsHint')}
      onSave={async (next) => {
        const result = await setContainerLearningGoalsAction(containerId, next);
        if (!result.ok) throw new SaveRefusedError(result.error);
        router.refresh();
      }}
    />
  );
}
