import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExerciseDisplay } from '../types';

interface ExercisePreviewProps {
  exercise: ExerciseDisplay;
}

interface LabeledItem {
  id?: unknown;
  text?: unknown;
}

const asItems = (value: unknown): { text: string }[] =>
  Array.isArray(value)
    ? (value as LabeledItem[]).map((i) => ({ text: typeof i.text === 'string' ? i.text : '' }))
    : [];

/** Read-only content preview of an exercise (answers omitted — served from `/display`). */
export function ExercisePreview({ exercise }: ExercisePreviewProps) {
  const t = useTranslations('Content');
  const content = exercise.content;
  const code = exercise.templateCode;

  const typeLabel =
    code in TYPE_LABEL_KEYS
      ? t(`exerciseTypes.${code}` as `exerciseTypes.${keyof typeof TYPE_LABEL_KEYS}`)
      : code;
  const firstInstruction = exercise.instructions?.[0]?.instructionText ?? null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">
            {t('exerciseTemplate')}: {typeLabel}
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
        {firstInstruction && <p className="text-muted-foreground text-xs">{firstInstruction}</p>}
      </CardHeader>

      <CardBody className="space-y-3">
        {code === 'multiple_choice' && (
          <div className="space-y-2">
            {typeof content.question === 'string' && <p className="text-sm font-medium">{content.question}</p>}
            <ul className="space-y-1.5">
              {asItems(content.options).map((o, i) => (
                <li key={i} className="rounded-md border border-border px-3 py-2 text-sm">
                  {o.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {code === 'fill_in_blank' && (
          <div className="space-y-2">
            {typeof content.text_with_blanks === 'string' && (
              <p className="text-sm leading-relaxed">{content.text_with_blanks}</p>
            )}
            {Array.isArray(content.word_bank) && content.word_bank.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium">{t('wordBank')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(content.word_bank as unknown[]).map((w, i) => (
                    <Badge key={i} variant="muted" className="text-xs">
                      {String(w)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(code === 'translate_to_target' || code === 'translate_from_target') && (
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">{t('translatePrompt')}</p>
            {typeof content.source_text === 'string' && <p className="text-sm">{content.source_text}</p>}
          </div>
        )}

        {code === 'match_pairs' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">{t('matchColumnLeft')}</p>
              <ul className="space-y-1.5">
                {asItems(content.left_items).map((o, i) => (
                  <li key={i} className="rounded-md border border-border px-3 py-2 text-sm">
                    {o.text}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">{t('matchColumnRight')}</p>
              <ul className="space-y-1.5">
                {asItems(content.right_items).map((o, i) => (
                  <li key={i} className="rounded-md border border-dashed border-border px-3 py-2 text-sm">
                    {o.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {code === 'short_answer' && (
          <div className="space-y-2">
            {typeof content.question === 'string' && <p className="text-sm font-medium">{content.question}</p>}
            {typeof content.context === 'string' && content.context && (
              <p className="text-muted-foreground text-xs">{content.context}</p>
            )}
            <div className="rounded-md border border-dashed border-border px-3 py-2">
              <p className="text-muted-foreground text-xs">{t('shortAnswerAnswer')}</p>
            </div>
          </div>
        )}

        {code === 'writing_task' && (
          <div className="space-y-2">
            {typeof content.prompt === 'string' && <p className="text-sm font-medium">{content.prompt}</p>}
            {Array.isArray(content.options) && content.options.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium">{t('writingTopics')}</p>
                <ul className="space-y-1.5">
                  {(content.options as LabeledItem[]).map((o, i) => (
                    <li key={i} className="rounded-md border border-border px-3 py-2 text-sm">
                      {typeof (o as { title?: unknown }).title === 'string'
                        ? (o as { title: string }).title
                        : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {code === 'sentence_schema' && (
          <div className="space-y-2">
            {typeof content.sentence === 'string' && <p className="text-sm font-medium">{content.sentence}</p>}
            <div className="overflow-x-auto">
              <div className="flex min-w-max gap-1.5">
                {(Array.isArray(content.fields) ? (content.fields as LabeledItem[]) : []).map((f, i) => (
                  <div
                    key={i}
                    className="min-w-20 flex-1 rounded-md border border-dashed border-border px-2 py-2 text-center"
                  >
                    <p className="text-muted-foreground text-[11px] font-medium">
                      {typeof (f as { label?: unknown }).label === 'string'
                        ? (f as { label: string }).label
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            {Array.isArray(content.tokens) && content.tokens.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium">{t('wordBank')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {asItems(content.tokens).map((tok, i) => (
                    <Badge key={i} variant="muted" className="text-xs">
                      {tok.text}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {code === 'word_bank_fill' && (
          <div className="space-y-2">
            {Array.isArray(content.word_bank) && content.word_bank.length > 0 && (
              <div>
                <p className="text-muted-foreground mb-1 text-xs font-medium">{t('wordBank')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(content.word_bank as unknown[])
                    .filter((w): w is string => typeof w === 'string')
                    .map((word, i) => (
                      <Badge key={i} variant="muted" className="text-xs">
                        {word}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
            <ol className="space-y-1.5">
              {(Array.isArray(content.items) ? (content.items as LabeledItem[]) : []).map((item, i) => (
                <li key={i} className="rounded-md border border-border px-3 py-2 text-sm">
                  {i + 1}.{' '}
                  {typeof (item as { text_with_blanks?: unknown }).text_with_blanks === 'string'
                    ? (item as { text_with_blanks: string }).text_with_blanks.replace(
                        /___\d+___/g,
                        '\u005B … \u005D',
                      )
                    : ''}
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

const TYPE_LABEL_KEYS = {
  multiple_choice: true,
  fill_in_blank: true,
  translate_to_target: true,
  translate_from_target: true,
  match_pairs: true,
  short_answer: true,
  writing_task: true,
  sentence_schema: true,
  word_bank_fill: true,
} as const;
