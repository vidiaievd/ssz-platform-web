/**
 * @deprecated OLD exercise-solving system — superseded by the `runner/`
 * exercises (placement, unit-flow practice) and the realigned authoring
 * exercise contract. No live consumers; slated for full removal.
 */
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import type { ExerciseDisplay } from '@/features/content/types';
import type { AttemptResult, ExerciseType } from '../types/exercise';
import { ClozeExercise } from './cloze';
import { FreeTextExercise } from './free-text';
import { MultipleChoiceExercise } from './multiple-choice';
import { PronunciationExercise } from './pronunciation';

interface ExerciseInteractionProps {
  exercise: ExerciseDisplay;
  /** Currently only wired for multiple_choice — used by flows that drive their own "next" step. */
  onAnswered?: (result: AttemptResult) => void;
}

const SUPPORTED_TYPES: ExerciseType[] = ['cloze', 'multiple_choice', 'free_text', 'pronunciation'];

export function ExerciseInteraction({ exercise, onAnswered }: ExerciseInteractionProps) {
  const t = useTranslations('Exercise');
  const type = exercise.templateCode as ExerciseType;

  if (!SUPPORTED_TYPES.includes(type)) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center">
        <p className="text-muted-foreground text-sm">{t('unsupportedType', { type })}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="muted" className="text-xs">
          {t(`type.${type}`)}
        </Badge>
        {exercise.difficultyLevel && (
          <Badge variant="level" className="text-xs">
            {exercise.difficultyLevel}
          </Badge>
        )}
      </div>

      {type === 'cloze' && <ClozeExercise exercise={exercise} />}
      {type === 'multiple_choice' && (
        <MultipleChoiceExercise exercise={exercise} onAnswered={onAnswered} />
      )}
      {type === 'free_text' && <FreeTextExercise exercise={exercise} />}
      {type === 'pronunciation' && <PronunciationExercise exercise={exercise} />}
    </div>
  );
}
