import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExerciseDisplay } from '../types';

interface ExercisePreviewProps {
  exercise: ExerciseDisplay;
}

export function ExercisePreview({ exercise }: ExercisePreviewProps) {
  const t = useTranslations('Content');
  const content = exercise.content;

  // Prompt and hints are common fields across exercise templates.
  const prompt = typeof content.prompt === 'string' ? content.prompt : null;
  const hints = Array.isArray(content.hints) ? (content.hints as string[]) : [];
  const exemplarAnswer =
    typeof content.exemplarAnswer === 'string' ? content.exemplarAnswer : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">
            {t('exerciseTemplate')}: {exercise.templateCode}
          </CardTitle>
          {exercise.difficultyLevel && (
            <Badge variant="level" className="text-xs">
              {exercise.difficultyLevel}
            </Badge>
          )}
          <Badge variant="muted" className="text-xs">
            {t('readOnly')}
          </Badge>
        </div>
        {exercise.instructions && (
          <p className="text-muted-foreground text-xs">{exercise.instructions}</p>
        )}
      </CardHeader>

      <CardBody className="space-y-3">
        {prompt && <p className="text-sm">{prompt}</p>}

        {hints.length > 0 && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">{t('hints')}</p>
            <ul className="space-y-0.5">
              {hints.map((h, i) => (
                <li key={i} className="text-muted-foreground text-xs">
                  • {h}
                </li>
              ))}
            </ul>
          </div>
        )}

        {exemplarAnswer && (
          <div className="bg-muted rounded-md p-3">
            <p className="text-muted-foreground mb-1 text-xs font-medium">{t('exemplarAnswer')}</p>
            <p className="text-sm">{exemplarAnswer}</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
