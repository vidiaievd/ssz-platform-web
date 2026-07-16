/**
 * @deprecated OLD exercise-solving system — superseded by the `runner/`
 * exercises (placement, unit-flow practice) and the realigned authoring
 * exercise contract. No live consumers; slated for full removal.
 */
import { useTranslations } from 'next-intl';
import { Smartphone } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ExerciseDisplay } from '@/features/content/types';
import { primaryInstructionText } from '@/features/content/lib/instruction-text';

interface PronunciationExerciseProps {
  exercise: ExerciseDisplay;
}

// Deep-link scheme for VoxOrd — update once the app is published.
const VOXORD_DEEP_LINK = 'voxord://exercise/';
const APP_STORE_URL = 'https://apps.apple.com/app/voxord';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.voxord';

export function PronunciationExercise({ exercise }: PronunciationExerciseProps) {
  const t = useTranslations('Exercise');
  const content = exercise.content;

  const text = typeof content.text === 'string' ? content.text : '';
  const ipa = typeof content.ipa === 'string' ? content.ipa : null;

  return (
    <div className="space-y-4">
      {primaryInstructionText(exercise.instructions) && (
        <p className="text-muted-foreground text-sm">
          {primaryInstructionText(exercise.instructions)}
        </p>
      )}

      <div className="rounded-lg border border-border bg-card p-4 text-center">
        <p className="text-2xl font-semibold tracking-wide">{text}</p>
        {ipa && (
          <p className="mt-1 font-mono text-sm text-muted-foreground">[{ipa}]</p>
        )}
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
        <div className="flex items-start gap-3">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
              {t('pronunciation.mobilePrompt')}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {t('pronunciation.mobileDescription')}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild variant="ghost" size="sm">
                <a
                  href={`${VOXORD_DEEP_LINK}${exercise.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('pronunciation.openApp')}
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                  App Store
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
                  Google Play
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
