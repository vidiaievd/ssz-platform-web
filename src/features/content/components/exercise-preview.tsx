import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { readContent as readErrorCorrectionContent } from '@/lib/shared-kernel/error-correction';
import {
  isShortAnswerDocument,
  readContent as readShortAnswerContent,
} from '@/lib/shared-kernel/short-answer';
import { readContent as readTranslateContent } from '@/lib/shared-kernel/translate';
import { readContent as readWritingTaskContent } from '@/lib/shared-kernel/writing-task';
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

        {code === 'multiple_choice_group' && (
          <ol className="space-y-2">
            {(Array.isArray(content.items) ? (content.items as LabeledItem[]) : []).map(
              (item, i) => {
                const q = item as { question?: unknown; options?: unknown };
                // Questions may carry their own options or lean on the group's.
                const options = asItems(Array.isArray(q.options) ? q.options : content.options);
                return (
                  <li key={i} className="rounded-md border border-border px-3 py-2">
                    <p className="text-sm font-medium">
                      {i + 1}. {typeof q.question === 'string' ? q.question : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {options.map((o, j) => (
                        <Badge key={j} variant="muted" className="text-xs">
                          {o.text}
                        </Badge>
                      ))}
                    </div>
                  </li>
                );
              },
            )}
          </ol>
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
          <TranslateContent content={content} code={code} />
        )}

        {code === 'match_pairs' && <MatchPairsContent content={content} />}

        {code === 'short_answer' && <ShortAnswerContent content={content} />}

        {code === 'writing_task' && <WritingTaskPrompt content={content} />}

        {code === 'sentence_schema' && <SentenceSchemaContent content={content} />}

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
        {code === 'text_order' && (
          <ol className="space-y-1.5">
            {(Array.isArray(content.items) ? (content.items as LabeledItem[]) : []).map((item, i) => (
              <li key={i} className="rounded-md border border-border px-3 py-2 text-sm">
                <span className="text-muted-foreground mr-1.5 text-xs">{i + 1}.</span>
                {typeof (item as { speaker?: unknown }).speaker === 'string' && (
                  <span className="mr-1.5 font-medium">{(item as { speaker: string }).speaker}:</span>
                )}
                {typeof (item as { text?: unknown }).text === 'string'
                  ? (item as { text: string }).text
                  : ''}
              </li>
            ))}
          </ol>
        )}
        {code === 'error_correction' && <ErrorCorrectionContent content={content} />}
      </CardBody>
    </Card>
  );
}

/**
 * The faulty sentences, exactly as the student meets them. No corrections are shown
 * because there are none to show: `content` carries no answer key, and the mistakes are
 * the difference between it and the `ref` kept in `expected_answers`.
 */
function ErrorCorrectionContent({ content }: { content: Record<string, unknown> }) {
  const { mode, items, note } = readErrorCorrectionContent(content);

  return (
    <div className="space-y-2">
      {note !== '' && <p className="text-muted-foreground text-xs">{note}</p>}
      {mode === 'passage' ? (
        // One stretch of text rather than a numbered set — the same split the runner makes.
        <div className="space-y-2">
          {items.map((item) => (
            <p key={item.id} className="text-sm leading-relaxed">
              {item.wrong}
            </p>
          ))}
        </div>
      ) : (
        <ol className="space-y-1.5">
          {items.map((item, i) => (
            <li key={item.id} className="rounded-md border border-border px-3 py-2 text-sm">
              <span className="text-muted-foreground mr-1.5 text-xs">{i + 1}.</span>
              {item.wrong}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * The task as the student meets it, and nothing else.
 *
 * `content` is the answer-free half of the document by construction (plan 50): the
 * example answer, the level descriptors and the point keywords live in
 * `expected_answers`, which never reaches this component. So the checklist can be shown
 * whole — there is no key in it to hide — while the rubric cannot be shown at all, since
 * its descriptors are the half that stayed behind.
 *
 * Pre-plan-50 documents (`prompt` / `options` / `min_words`) coerce to an empty task
 * rather than throwing: `readContent` fills defaults, and what is missing simply does not
 * render.
 */
function WritingTaskPrompt({ content }: { content: Record<string, unknown> }) {
  const t = useTranslations('Content');
  const tw = useTranslations('ExerciseRunner.writingTask');
  const { mode, instruction, prompt, source, letter, points, phrases, settings } =
    readWritingTaskContent(content);
  const { minWords, maxWords } = settings;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="muted" className="text-xs">
          {tw(`modes.${mode}`)}
        </Badge>
        {minWords > 0 && (
          <span className="text-muted-foreground text-xs">
            {maxWords > 0 ? `${minWords}–${maxWords}` : `${minWords}+`} {t('writingWords')}
          </span>
        )}
      </div>

      {instruction !== '' && <p className="text-muted-foreground text-xs">{instruction}</p>}
      {prompt !== '' && <p className="text-sm font-medium">{prompt}</p>}

      {mode === 'letter' && letter.recipient !== '' && (
        <p className="text-muted-foreground text-xs">
          {tw('letterLine', {
            recipient: letter.recipient,
            register: tw(`register.${letter.register}`),
          })}
        </p>
      )}

      {mode === 'retell' && source !== '' && (
        <p className="rounded-md border border-border px-3 py-2 text-sm leading-relaxed">
          {source}
        </p>
      )}

      {points.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-medium">{tw('checklistTitle')}</p>
          <ul className="space-y-1.5">
            {points.map((point) => (
              <li key={point.id} className="rounded-md border border-border px-3 py-2 text-sm">
                {point.text}
                {!point.required && (
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    {t('writingPointOptional')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {phrases.length > 0 && (
        <div>
          <p className="text-muted-foreground mb-1 text-xs font-medium">{tw('phrasesTitle')}</p>
          <div className="flex flex-wrap gap-1.5">
            {phrases.map((phrase, i) => (
              <Badge key={i} variant="muted" className="text-xs">
                {phrase}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * short_answer — one template code over two live document shapes (plan 51 §8 Q1).
 *
 * The new form is a set of open questions; the old one is a single question with a
 * context line, and 144 exercises are still written in it. The document says which is
 * which — `questions` is an array in one and absent from the other — and this is the
 * same test the validator, the runners and the BFF dispatch on.
 *
 * Neither branch can show an answer. For the old form the accepted strings live in
 * `expected_answers`; for the new one so do the semantic elements, their anchor phrases
 * and the model answer — and those are the answer written in the words the student is
 * asked to find. `/display` serves neither column, so the preview shows the questions
 * and marks where the answer would go.
 */
function ShortAnswerContent({ content }: { content: Record<string, unknown> }) {
  const t = useTranslations('Content');
  const ts = useTranslations('ExerciseRunner.set');

  if (!isShortAnswerDocument(content)) {
    return (
      <div className="space-y-2">
        {typeof content.question === 'string' && (
          <p className="text-sm font-medium">{content.question}</p>
        )}
        {typeof content.context === 'string' && content.context && (
          <p className="text-muted-foreground text-xs">{content.context}</p>
        )}
        <div className="rounded-md border border-dashed border-border px-3 py-2">
          <p className="text-muted-foreground text-xs">{t('shortAnswerAnswer')}</p>
        </div>
      </div>
    );
  }

  const { title, instruction, questions } = readShortAnswerContent(content);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="muted" className="text-xs">
          {ts('badge')}
        </Badge>
        <span className="text-muted-foreground text-xs">
          {ts('count', { n: questions.length })}
        </span>
      </div>

      {title !== '' && <p className="text-sm font-medium">{title}</p>}
      {instruction !== '' && <p className="text-muted-foreground text-xs">{instruction}</p>}

      <ol className="space-y-2">
        {questions.map((question, i) => (
          <li key={question.id} className="space-y-1.5 rounded-md border border-border px-3 py-2">
            <p className="text-sm font-medium">
              <span className="text-muted-foreground mr-1.5 text-xs">{i + 1}.</span>
              {question.prompt}
            </p>
            {question.passage !== '' && (
              <p className="text-muted-foreground border-l-2 border-border pl-2 text-xs leading-relaxed whitespace-pre-wrap">
                {question.kind === 'listening' && (
                  <span className="mr-1.5 font-medium">{t('shortAnswerTranscript')}</span>
                )}
                {question.passage}
              </p>
            )}
            <div className="rounded-md border border-dashed border-border px-3 py-1.5">
              <p className="text-muted-foreground text-xs">{t('shortAnswerAnswer')}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * match_pairs — read-only, and read through the projection.
 *
 * `/display` serves this template as a student projection (plan 49): left halves as
 * `slots`, every right half — answers and distractors alike — as one shuffled `pool`.
 * That is the same thing the learner sees, and it is the only shape available here: the
 * pairing never leaves the server, so this preview cannot show which half answers which
 * slot, and must not pretend to.
 *
 * Pre-plan-49 documents reach `/display` through the same projection, so the legacy
 * `left_items` / `right_items` shape is handled upstream and never arrives here.
 */
function MatchPairsContent({ content }: { content: Record<string, unknown> }) {
  const t = useTranslations('Content');
  const slots = Array.isArray(content.slots)
    ? (content.slots as { left?: unknown }[]).map((slot) =>
        typeof slot.left === 'string' ? slot.left : '',
      )
    : [];
  const pool = Array.isArray(content.pool)
    ? (content.pool as { text?: unknown }[]).map((item) =>
        typeof item.text === 'string' ? item.text : '',
      )
    : [];

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="text-muted-foreground mb-1 text-xs font-medium">{t('matchColumnLeft')}</p>
        <ul className="space-y-1.5">
          {slots.map((left, i) => (
            <li key={i} className="rounded-md border border-border px-3 py-2 text-sm">
              {left}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-muted-foreground mb-1 text-xs font-medium">{t('matchColumnRight')}</p>
        <ul className="space-y-1.5">
          {pool.map((text, i) => (
            <li key={i} className="rounded-md border border-dashed border-border px-3 py-2 text-sm">
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * The sentences to translate, and nothing else: the accepted translations are the answer
 * key and live in `expected_answers`, which `/display` does not serve. Read through the
 * kernel rather than off the raw record — the direction of a sentence may differ from the
 * exercise's own when `dir` is `both`.
 */
function TranslateContent({
  content,
  code,
}: {
  content: Record<string, unknown>;
  code: 'translate_to_target' | 'translate_from_target';
}) {
  const t = useTranslations('Content');
  const { langs, note, items } = readTranslateContent(content, code);

  const label = (itemDir: 'to_target' | 'from_target') =>
    itemDir === 'to_target'
      ? `${langs.explain.toUpperCase()} → ${langs.target.toUpperCase()}`
      : `${langs.target.toUpperCase()} → ${langs.explain.toUpperCase()}`;

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-xs font-medium">{t('translatePrompt')}</p>
      {note !== '' && <p className="text-muted-foreground text-xs">{note}</p>}
      <ol className="space-y-1.5">
        {items.map((item, i) => (
          <li key={item.id} className="rounded-md border border-border px-3 py-2 text-sm">
            <span className="text-muted-foreground mr-1.5 text-xs">{i + 1}.</span>
            <span className="text-muted-foreground mr-1.5 text-[11px] uppercase">
              {label(item.dir)}
            </span>
            {item.source}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * sentence_schema — read-only, and read through the projection.
 *
 * `/display` serves this template as a student projection (plan 52 §3.2): the fields of
 * each sentence, the bank the server shuffled, and the prompt where there is one. Which
 * field a chunk belongs in never leaves the server, so this preview cannot show the
 * finished board and must not pretend to — what a teacher sees here is what the learner
 * starts from.
 *
 * A document that is not a set says so instead of drawing an empty board. All seven
 * seeded exercises were rewritten (§8 Q7), so one arriving in the pre-plan-52 shape is a
 * leftover that needs rewriting rather than an exercise with nothing in it — and that is
 * the same answer the validator, the runners and the projection give it.
 */
function SentenceSchemaContent({ content }: { content: Record<string, unknown> }) {
  const t = useTranslations('Content');
  const ts = useTranslations('ExerciseRunner.set');

  const rows = Array.isArray(content.rows) ? (content.rows as Record<string, unknown>[]) : null;
  if (rows === null) {
    return <p className="text-muted-foreground text-sm">{t('sentenceSchemaNotASet')}</p>;
  }

  const instruction = typeof content.instruction === 'string' ? content.instruction : '';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="muted" className="text-xs">
          {ts('badge')}
        </Badge>
        <span className="text-muted-foreground text-xs">
          {t('sentenceSchemaCount', { n: rows.length })}
        </span>
      </div>

      {instruction !== '' && <p className="text-muted-foreground text-xs">{instruction}</p>}

      <ol className="space-y-2">
        {rows.map((row, i) => {
          const fields = Array.isArray(row.fields)
            ? (row.fields as { short?: unknown; label?: unknown }[])
            : [];
          const bank = asItems(row.bank);
          const source = typeof row.source === 'string' ? row.source : '';

          return (
            <li key={i} className="space-y-2 rounded-md border border-border px-3 py-2">
              {/* The sentence to rewrite, where there is one. The sentence being built is
                  the answer, and it is not in this payload at all. */}
              {source !== '' && (
                <p className="text-sm font-medium">
                  <span className="text-muted-foreground mr-1.5 text-xs">{i + 1}.</span>
                  {source}
                </p>
              )}
              <div className="overflow-x-auto">
                <div className="flex min-w-max gap-1.5">
                  {fields.map((field, j) => (
                    <div
                      key={j}
                      className="min-w-20 flex-1 rounded-md border border-dashed border-border px-2 py-2 text-center"
                    >
                      <p className="text-muted-foreground text-[11px] font-medium">
                        {typeof field.label === 'string' && field.label !== ''
                          ? field.label
                          : typeof field.short === 'string'
                            ? field.short
                            : ''}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              {bank.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium">{t('wordBank')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {bank.map((item, j) => (
                      <Badge key={j} variant="muted" className="text-xs">
                        {item.text}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const TYPE_LABEL_KEYS = {
  multiple_choice: true,
  multiple_choice_group: true,
  fill_in_blank: true,
  translate_to_target: true,
  translate_from_target: true,
  match_pairs: true,
  short_answer: true,
  writing_task: true,
  sentence_schema: true,
  word_bank_fill: true,
  text_order: true,
  error_correction: true,
} as const;
