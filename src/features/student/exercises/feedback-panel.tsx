import { useTranslations } from 'next-intl';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { AttemptResult } from '../types/exercise';

interface FeedbackPanelProps {
  result: AttemptResult;
  onRetry: () => void;
}

const ICONS = {
  correct: CheckCircle,
  partial: AlertCircle,
  incorrect: XCircle,
} as const;

const STYLES = {
  correct: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-200',
  partial: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200',
  incorrect: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200',
} as const;

export function FeedbackPanel({ result, onRetry }: FeedbackPanelProps) {
  const t = useTranslations('Exercise');
  const Icon = ICONS[result.verdict];

  const correctAnswerText = Array.isArray(result.correctAnswer)
    ? result.correctAnswer.join(', ')
    : result.correctAnswer;

  return (
    <div
      className={`mt-4 rounded-lg border p-4 ${STYLES[result.verdict]}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{t(`verdict.${result.verdict}`)}</p>

          {correctAnswerText && result.verdict !== 'correct' && (
            <p className="text-sm">
              {t('correctAnswer')}: <span className="font-medium">{correctAnswerText}</span>
            </p>
          )}

          {result.explanation && (
            <p className="text-sm">{result.explanation}</p>
          )}
        </div>
      </div>

      {result.canRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="mt-3"
        >
          {t('tryAgain')}
        </Button>
      )}
    </div>
  );
}
