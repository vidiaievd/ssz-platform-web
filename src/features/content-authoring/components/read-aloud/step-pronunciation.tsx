'use client';

import { useTranslations } from 'next-intl';
import { Eye, RotateCw, Spline } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useCan } from '@/features/entitlements';
import {
  PRONUNCIATION_LENSES,
  type Issue,
  type PronunciationLens,
} from '@/lib/shared-kernel/read-aloud';

import { Callout, Card, StepHead } from '../highlight-in-text/parts';
import { LayerSaveLine, ProsodyEditor, type EditorNeed } from '../prosody-editor';
import { ToggleRow } from '../toggle-row';
import { setGuide, toggleLens, type ReadAloudDocument } from './edits';
import { useIssueCopy } from './issue-copy';
import type { PromptProsody, PromptProsodyState } from './use-prompt-prosody';

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;

const LENS_KEYS: Record<
  PronunciationLens,
  'lensStress' | 'lensSounds' | 'lensRespell' | 'lensMelody'
> = {
  stress: 'lensStress',
  sounds: 'lensSounds',
  respell: 'lensRespell',
  melody: 'lensMelody',
};

export interface StepPronunciationProps {
  exercise: ReadAloudDocument;
  onChange: (next: ReadAloudDocument) => void;
  prosody: PromptProsody;
  /** The kernel's issues of the whole document, read with the prompts' layers. */
  problems: Issue[];
}

/**
 * Step 6, drawn second: «Reading with a pronunciation guide» (plan 86, §4i.4).
 *
 * What the learner is offered — the sentence drill and the lenses — is the document's and is
 * saved with it. The marks are not: each passage has a layer of its own, shared by the draft and
 * the published version, and applied as soon as it is saved. Stress and sounds come from the
 * lexicon by themselves; the author settles only what the lexicon could not (a name like
 * *Bartek*) and, with «Melody», the end of every sentence. Those are the step's blockers, the
 * kernel's `guideIssues`, the same list the publish preflight runs.
 *
 * Each passage gets the shared `ProsodyEditor` once its marks lie on the text shown (a text being
 * typed waits for its autosave); edits are saved on their own, as the layer's autosave. ✦ is
 * offered when the workspace's plan has `ai.authoring`.
 */
export function StepPronunciation({
  exercise,
  onChange,
  prosody,
  problems,
}: StepPronunciationProps) {
  const t = useTranslations('Authoring.readAloud');
  const lenses = useTranslations('ExerciseRunner.prosody');
  const copy = useIssueCopy(exercise);
  // ✦ spends the owner's `ai.authoring` credits; without the key the agent would refuse it.
  const can = useCan();
  const guide = exercise.pronunciationGuide;
  const own = problems.filter((issue) => issue.step === 6);

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('step6.eyebrow')} title={t('step6.title')} lede={t('step6.lede')} />

      <Card icon={Eye} title={t('step6.learnerTitle')}>
        <ToggleRow
          label={t('step6.drillLabel')}
          help={t('step6.drillHelp')}
          checked={guide.sentenceDrill}
          onChange={(sentenceDrill) => onChange(setGuide(exercise, { sentenceDrill }))}
        />
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-sm">{t('step6.lensesLabel')}</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {PRONUNCIATION_LENSES.map((lens) => (
              <label key={lens} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={guide.lenses.includes(lens)}
                  onCheckedChange={() => onChange(toggleLens(exercise, lens))}
                />
                {lenses(LENS_KEYS[lens])}
              </label>
            ))}
          </div>
          <p className="m-0 text-xs text-(--ssz-text-muted)">
            {guide.lenses.includes('melody') ? t('step6.needMelody') : t('step6.needWords')}
          </p>
        </fieldset>
      </Card>

      <Callout tone="info">{t('step6.appliesNow')}</Callout>

      {exercise.prompts.map((prompt, i) => {
        const name =
          prompt.label.trim() === '' ? t('subject.prompt', { index: i + 1 }) : prompt.label;
        const state = prosody.byPassage[prompt.id];
        const blockers = own.filter(
          (issue) =>
            'promptId' in issue && issue.promptId === prompt.id && issue.level === 'blocker',
        ).length;
        const view = state?.status === 'loaded' ? state.view : null;
        const stale = view !== null && view.text !== prompt.text;
        const unresolved = view?.lexicon.unresolved ?? [];
        const layer = prosody.layerOf(prompt.id);
        const needs = own.flatMap((issue): EditorNeed[] => {
          if (!('promptId' in issue) || issue.promptId !== prompt.id) return [];
          if (issue.code === 'RA_GUIDE_WORD_UNCONFIRMED') return [{ kind: 'word', i: issue.i }];
          if (issue.code === 'RA_GUIDE_SENTENCE_NO_END') {
            return [{ kind: 'end', sentence: issue.sentence }];
          }
          return [];
        });

        return (
          <Card
            key={prompt.id}
            icon={Spline}
            title={name}
            note={
              prompt.text.trim() === '' ? null : (
                <PromptStatus
                  state={stale ? { status: 'loading' } : state}
                  blockers={blockers}
                  onRetry={() => prosody.reload(prompt.id)}
                />
              )
            }
          >
            {prompt.text.trim() === '' ? (
              <p className="m-0 text-sm text-(--ssz-text-muted)">{t('step6.noText')}</p>
            ) : (
              <>
                <p className="m-0 text-lg leading-relaxed" style={READING}>
                  {prompt.text}
                </p>
                {unresolved.length > 0 && (
                  <p className="m-0 text-sm text-(--ssz-text-secondary)">
                    {t('step6.unresolved', {
                      words: unresolved.map((word) => word.w).join(', '),
                    })}
                  </p>
                )}
                {view !== null && !stale && layer !== null && (
                  <ProsodyEditor
                    text={view.text}
                    layer={layer}
                    lexicon={view.lexicon}
                    needs={needs}
                    lang={exercise.language || undefined}
                    onChange={(next) => prosody.edit(prompt.id, next)}
                    onSuggest={can('ai.authoring') ? () => prosody.suggest(prompt.id) : undefined}
                  />
                )}
                <LayerSaveLine
                  state={prosody.saves[prompt.id]}
                  onRetry={() => prosody.retry(prompt.id)}
                />
              </>
            )}
          </Card>
        );
      })}

      <section aria-label={t('step6.issuesLabel')} className="flex flex-col gap-2">
        {own.length === 0 ? (
          <Callout tone="tip">{t('step6.ready')}</Callout>
        ) : (
          own.map((issue, index) => (
            <Callout key={`${issue.code}-${index}`} tone="warn">
              {copy.describe(issue)}
            </Callout>
          ))
        )}
      </section>
    </div>
  );
}

function PromptStatus({
  state,
  blockers,
  onRetry,
}: {
  state: PromptProsodyState | undefined;
  blockers: number;
  onRetry: () => void;
}) {
  const t = useTranslations('Authoring.readAloud.step6');

  if (state === undefined || state.status === 'loading') return <span>{t('statusLoading')}</span>;
  if (state.status === 'failed') {
    return (
      <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onRetry}>
        <RotateCw className="size-3.5" aria-hidden />
        {t('statusFailed')}
      </Button>
    );
  }
  if (blockers > 0) {
    return (
      <span className="text-(--ssz-color-error-700)">
        {t('statusBlockers', { count: blockers })}
      </span>
    );
  }
  return <span className="text-(--ssz-color-success-700)">{t('statusOk')}</span>;
}
