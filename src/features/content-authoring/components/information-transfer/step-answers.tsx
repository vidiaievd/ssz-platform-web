'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  acceptedForms,
  expectedOf,
  gradeCell,
  issues,
  keyPasses,
  packOf,
  passes,
  type CellGrade,
  type Field,
  type InformationTransferContent,
  type Issue,
} from '@/lib/shared-kernel/information-transfer';

import { Notes, type Note } from '../dictation/notes';
import { Card, EmptyState, StepHead } from '../highlight-in-text/parts';
import { MONO } from '../minimal-pairs/parts';
import { ToggleRow } from '../toggle-row';
import { setExpected, setGrading } from './edits';
import { useIssueCopy, useTypeLabel } from './issue-copy';

export interface StepAnswersProps<T extends InformationTransferContent> {
  exercise: T;
  onChange: (next: T) => void;
}

/** A chip of the accepted set: the author's own notation, one the core adds, or none at all. */
type ChipKind = 'ok' | 'format' | 'bad';

const CHIP: Record<ChipKind, string> = {
  ok: 'border-(--ssz-color-success-100) bg-(--ssz-color-success-50) text-(--ssz-color-success-700)',
  format: 'border-(--ssz-border-default) bg-(--ssz-bg-subtle) text-(--ssz-text-secondary)',
  bad: 'border-(--ssz-color-error-300) bg-(--ssz-color-error-50) text-(--ssz-color-error-700)',
};

/**
 * Step 3: what counts as the same answer (plan 73 §7.4, INF-B13…B16).
 *
 * The rules are the core's, per field type — the author names the fact and the normaliser
 * knows its notations. So this step does not ask for spellings; it shows them. Every chip of
 * the table is a notation the kernel's generator writes for the cell's first expected value,
 * **put through the same `gradeCell` the engine runs**: green is a notation the author wrote,
 * grey one the core recognised on its own, red one it cannot read. «Try an answer» is that
 * judge again on whatever the author types, and it stays in this step — nothing typed there
 * reaches the document.
 *
 * The three switches change the judge, so the table and the try-line follow them at once. A
 * course without a language pack has no lexicon of numerals (Q2-A): the first switch is inert
 * and says why rather than promising something the core cannot do.
 */
export function StepAnswers<T extends InformationTransferContent>({
  exercise,
  onChange,
}: StepAnswersProps<T>) {
  const t = useTranslations('Authoring.informationTransfer.step3');
  const copy = useIssueCopy();
  const pack = packOf(exercise);
  const g = exercise.grading;
  const [tries, setTries] = useState<Record<string, string>>({});

  const own = issues(exercise).filter((issue) => issue.step === 3);
  const settingNotes: Note[] = own
    .filter(
      (issue) =>
        issue.code === 'INF_TYPOS_ON' ||
        issue.code === 'INF_SPELLED_OFF' ||
        issue.code === 'INF_CASE_SENSITIVE',
    )
    .map((issue) => ({ key: issue.code, level: issue.level, text: copy.describe(issue) }));
  const tableNotes: Note[] = own
    .filter((issue) => issue.code === 'INF_KEY_FAILS_GRADER')
    .map((issue) => ({ key: issue.code, level: issue.level, text: copy.describe(issue) }));

  const fields = exercise.fields.filter((f) => expectedOf(f).length > 0);
  const passing = keyPasses(exercise);

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <Card>
        <ToggleRow
          label={t('spelled.label')}
          help={t('spelled.help')}
          checked={pack !== undefined && g.spelledNumbers}
          {...(pack === undefined ? { disabledReason: t('spelled.noPack') } : {})}
          onChange={(spelledNumbers) => onChange(setGrading(exercise, { spelledNumbers }))}
        />
        <ToggleRow
          label={t('typos.label')}
          help={t('typos.help')}
          checked={g.typos}
          onChange={(typos) => onChange(setGrading(exercise, { typos }))}
        />
        <ToggleRow
          label={t('strictCase.label')}
          help={t('strictCase.help')}
          checked={g.strictCase}
          onChange={(strictCase) => onChange(setGrading(exercise, { strictCase }))}
        />
        <Notes notes={settingNotes} />
      </Card>

      <section
        aria-labelledby="inf-accepted-title"
        data-bad={passing ? undefined : 'true'}
        className={`rounded-(--ssz-radius-md) border bg-(--ssz-bg-surface) ${
          passing ? 'border-(--ssz-border-default)' : 'border-(--ssz-color-error-500)'
        }`}
        style={{ boxShadow: 'var(--ssz-shadow-xs)' }}
      >
        <div className="flex items-center gap-2 border-b border-(--ssz-border-default) py-2 pr-2 pl-3">
          <Check size={15} aria-hidden="true" className="shrink-0" />
          <h3 id="inf-accepted-title" className="m-0 text-sm font-semibold">
            {t('accepted.title')}
          </h3>
          <span className="flex-1" />
          <span
            className={`text-[11px] ${passing ? 'text-(--ssz-text-muted)' : 'text-(--ssz-color-error-700)'}`}
            style={MONO}
          >
            {passing ? t('accepted.passes') : t('accepted.fails')}
          </span>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {fields.length === 0 ? (
            <EmptyState
              icon={AlertTriangle}
              title={t('accepted.emptyTitle')}
              body={t('accepted.emptyBody')}
            />
          ) : (
            <div className="flex flex-col @container">
              {fields.map((field, index) => (
                <AcceptedRow
                  key={field.id}
                  exercise={exercise}
                  field={field}
                  first={index === 0}
                  tried={tries[field.id] ?? ''}
                  onTry={(value) => setTries((current) => ({ ...current, [field.id]: value }))}
                  onChange={onChange}
                />
              ))}
            </div>
          )}
          <Notes notes={tableNotes} />
          <p className="m-0 text-xs text-(--ssz-text-muted)">{t('accepted.caption')}</p>
        </div>
      </section>

      <Card icon={Info} title={t('rule.title')} labelledBy="inf-rule-title">
        <p className="m-0 text-xs text-(--ssz-text-muted)">
          {t.rich('rule.body', {
            mono: (chunks) => <span style={MONO}>{chunks}</span>,
          })}
        </p>
      </Card>
    </div>
  );
}

/**
 * `inf-accrow`: the cell's label and type, the accepted set, and the try-line.
 *
 * What the kernel says about this one cell — a key it cannot read, a clock time that reads two
 * ways — is drawn under the row it is about; the 24-hour fix is one press, since the kernel has
 * already worked out the reading to write.
 */
function AcceptedRow<T extends InformationTransferContent>({
  exercise,
  field,
  first,
  tried,
  onTry,
  onChange,
}: {
  exercise: T;
  field: Field;
  first: boolean;
  tried: string;
  onTry: (value: string) => void;
  onChange: (next: T) => void;
}) {
  const t = useTranslations('Authoring.informationTransfer.step3');
  const copy = useIssueCopy();
  const typeLabel = useTypeLabel();
  const pack = packOf(exercise);
  const g = exercise.grading;

  const forms = acceptedForms(field, pack);
  const chips = forms.map((form) => {
    const grade = gradeCell(field, form, g, pack);
    const kind: ChipKind = !passes(grade.verdict)
      ? 'bad'
      : grade.verdict === 'ok'
        ? 'ok'
        : 'format';
    return { form, kind };
  });

  const result = tried.trim() === '' ? null : gradeCell(field, tried, g, pack);
  const label = field.label.trim() === '' ? t('accepted.unnamed') : field.label;
  const tryId = `inf-try-${field.id}`;

  const own = issues(exercise).filter(
    (issue): issue is Extract<Issue, { fieldId: string }> =>
      'fieldId' in issue &&
      issue.fieldId === field.id &&
      (issue.code === 'INF_KEY_UNREADABLE' || issue.code === 'INF_TIME_AMBIGUOUS'),
  );

  return (
    <div
      data-testid={`inf-accrow-${field.id}`}
      className={`grid grid-cols-1 gap-3 py-[11px] @min-[560px]:grid-cols-[150px_minmax(0,1fr)_190px] ${
        first ? '' : 'border-t border-(--ssz-border-default)'
      }`}
    >
      <b className="min-w-0 text-sm font-semibold">
        <span className="block truncate">{label}</span>
        <span className="block text-[11px] font-normal text-(--ssz-text-muted)" style={MONO}>
          {field.type}
        </span>
      </b>

      <div className="flex min-w-0 flex-col gap-2">
        <ul
          className="m-0 flex list-none flex-wrap gap-1.5 p-0"
          aria-label={t('accepted.chips', { label })}
        >
          {chips.length === 0 ? (
            <li
              data-v="bad"
              className={`rounded-full border px-[9px] py-1 text-[11px] ${CHIP.bad}`}
              style={MONO}
            >
              {t('accepted.nothing')}
            </li>
          ) : (
            chips.map(({ form, kind }) => (
              <li
                key={form}
                data-v={kind}
                className={`rounded-full border px-[9px] py-1 text-[11px] ${CHIP[kind]}`}
                style={MONO}
              >
                {form}
              </li>
            ))
          )}
        </ul>
        {own.map((issue, i) => (
          <div
            key={`${issue.code}-${i}`}
            data-level={issue.level}
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${
              issue.level === 'blocker' ? 'text-(--ssz-color-error-700)' : 'text-(--ssz-text-muted)'
            }`}
          >
            {issue.level === 'blocker' ? (
              <AlertTriangle size={13} aria-hidden="true" className="shrink-0" />
            ) : (
              <Info size={13} aria-hidden="true" className="shrink-0" />
            )}
            <span className="min-w-0 flex-1">{copy.describe(issue, { bare: true })}</span>
            {issue.code === 'INF_TIME_AMBIGUOUS' && issue.suggestion !== '' && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={() => onChange(setExpected(exercise, field.id, 0, issue.suggestion))}
              >
                {copy.fix(issue)}
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex min-w-0 flex-col gap-[5px]">
        <Input
          id={tryId}
          aria-label={t('accepted.tryLabel', { label })}
          className="h-8 text-xs"
          style={MONO}
          value={tried}
          placeholder={t('accepted.tryPlaceholder')}
          onChange={(event) => onTry(event.target.value)}
        />
        <TryVerdict result={result} typeName={typeLabel(field.type).toLowerCase()} />
      </div>
    </div>
  );
}

/** `inf-testv`: what the real judge says about the try, in the prototype's five phrasings. */
function TryVerdict({ result, typeName }: { result: CellGrade | null; typeName: string }) {
  const t = useTranslations('Authoring.informationTransfer.step3.accepted');
  if (result === null) {
    return <span className="text-[11px] text-(--ssz-text-muted)">{t('tryIdle')}</span>;
  }
  const ok = passes(result.verdict);
  const text =
    result.verdict === 'ok'
      ? t('tryOk')
      : result.verdict === 'format'
        ? t('tryFormat', { canonical: result.canonical ?? '' })
        : result.verdict === 'typo'
          ? t('tryTypo')
          : result.verdict === 'unread'
            ? t('tryUnread', { type: typeName })
            : t('tryWrong');
  const Icon = ok ? Check : X;
  return (
    <span
      role="status"
      data-v={result.verdict}
      className={`flex items-center gap-1 text-[11px] font-semibold ${
        ok ? 'text-(--ssz-color-success-700)' : 'text-(--ssz-color-error-700)'
      }`}
    >
      <Icon size={12} aria-hidden="true" className="shrink-0" />
      {text}
    </span>
  );
}
