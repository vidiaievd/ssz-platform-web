'use client';

import { useTranslations } from 'next-intl';

import { DataState } from '@/components/shared/data-state';
import { useContainerItems } from '../api/use-container-items';
import { useExerciseDisplay } from '../api/use-exercise';
import { ExercisePreview } from './exercise-preview';

interface ExercisesTabProps {
  containerId: string;
  versionId?: string;
}

function ExerciseSection({ exerciseId }: { exerciseId: string }) {
  const { data: exercise, isLoading, error } = useExerciseDisplay(exerciseId);

  return (
    <DataState isLoading={isLoading} error={error ? { code: 'unknown' } : null} isEmpty={!exercise}>
      {exercise && <ExercisePreview exercise={exercise} />}
    </DataState>
  );
}

export function ExercisesTab({ containerId, versionId }: ExercisesTabProps) {
  const t = useTranslations('Content');
  const { data, isLoading, error, refetch } = useContainerItems(
    containerId,
    versionId ?? '',
    !!versionId,
  );

  const items = (data ?? []).filter((i) => i.contentType === 'EXERCISE');

  return (
    <DataState
      isLoading={isLoading}
      error={error ? { code: 'unknown' } : null}
      isEmpty={!isLoading && items.length === 0}
      onRetry={() => void refetch()}
      emptySlot={
        <p className="text-muted-foreground py-8 text-center text-sm">{t('noExercises')}</p>
      }
    >
      <div className="space-y-4">
        {items.map((item) => (
          <ExerciseSection key={item.id} exerciseId={item.contentId} />
        ))}
      </div>
    </DataState>
  );
}
