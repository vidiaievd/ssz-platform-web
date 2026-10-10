'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Shuffle, Split, Wand2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { useClipPlayer, type ClipPlayer } from '@/features/student/exercises/runner';
import {
  allWords,
  CLIP_LIMITS,
  contrastsInSet,
  contrastsOf,
  exerciseContrast,
  filledWords,
  hasClip,
  issues,
  missingClips,
  packFor,
  pairContrast,
  pairSpread,
  voicesOf,
  wordCount,
  type ContrastFamily,
  type Issue,
} from '@/lib/shared-kernel/minimal-pairs';

import { Notes, type Note } from '../dictation/notes';
import { Bar, Callout, Card, Field, StepHead } from '../highlight-in-text/parts';
import { browserClipSources, type ClipSources } from './clip-sources';
import { ClipRow } from './clip-row';
import {
  clearClip,
  relabelVoice,
  setDialect,
  type DocumentUpdate,
  type MinimalPairsDocument,
} from './edits';
import { useIssueCopy } from './issue-copy';
import { PairCard, TtsChip } from './parts';
import { SlicePanel } from './slice-panel';
import { useClipAssets } from './use-clip-assets';
import { useWordSources, type WordRef } from './use-word-sources';

/** Findings of step 2 that are about the whole set, drawn under the coverage line. */
const SET_CODES = new Set<Issue['code']>([
  'MP_TTS_BLOCKED',
  'MP_TTS_RISKY',
  'MP_TTS_NOTE',
  'MP_DIALECT_MISSING',
]);

/** The «not set» dialect, as a radio value — an empty one is not a value. */
const NO_DIALECT = 'none';

export interface StepClipsProps {
  exercise: MinimalPairsDocument;
  exerciseId: string;
  /** The author's display name: the voice of a recording made here. */
  teacherVoice: string;
  onChange: DocumentUpdate;
  /** Tests stand in for the network and the microphone; left out, the browser's. */
  sources?: ClipSources;
  player?: ClipPlayer;
}

/**
 * Step 2: one clip per word (plan 72 §7.3, MP-B9…B16).
 *
 * A row per word with text, in pair order; how many have audio on top. The checks the author
 * needs while recording are drawn where the pair is — two voices with the relabel buttons, the
 * length spread, the dialect of a toneme pair — and they are the kernel's issues, the ones the
 * gate and the publish preflight run. The synthesis policy is the pair's family's: «TTS» is off
 * on a pair whose family synthesis merges, even in a set whose own family allows it (§4.2 p. 2).
 */
export function StepClips({
  exercise,
  exerciseId,
  teacherVoice,
  onChange,
  sources = browserClipSources,
  player,
}: StepClipsProps) {
  const t = useTranslations('Authoring.minimalPairs.step2');
  const tm = useTranslations('Authoring.minimalPairs');
  const copy = useIssueCopy(exercise);
  const clips = useClipPlayer(player);
  const assets = useClipAssets(exercise, sources, onChange);
  const words = useWordSources({
    sources,
    exerciseId,
    language: exercise.language,
    teacherVoice,
    onChange,
  });
  const [slicing, setSlicing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<WordRef | null>(null);

  const total = wordCount(exercise);
  const covered = total - missingClips(exercise);
  const maxMs = Math.max(700, ...allWords(exercise).map((w) => w.clip.durationMs));
  const found = issues(exercise).filter((issue) => issue.step === 2);
  const setNotes: Note[] = found
    .filter((issue) => SET_CODES.has(issue.code))
    .map((issue, i) => ({
      key: `${issue.code}-${i}`,
      level: issue.level,
      text: copy.describe(issue),
    }));
  const dialects = packFor(exercise.language)?.dialects ?? [];

  const urlOf = (assetId: string) => assets.get(assetId)?.url ?? '';

  return (
    <div className="flex flex-col gap-5">
      <StepHead eyebrow={t('eyebrow')} title={t('title')} lede={t('lede')} />

      <div className="flex flex-wrap items-center gap-4 rounded-(--ssz-radius-md) border border-(--ssz-border-default) bg-(--ssz-bg-surface) p-4">
        <div>
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            {covered}
            <i className="text-base font-normal text-(--ssz-text-muted) not-italic"> / {total}</i>
          </span>
          <p className="m-0 text-xs text-(--ssz-text-muted)">{t('covered')}</p>
        </div>
        <div className="min-w-[120px] flex-1">
          <Bar value={total === 0 ? 0 : (covered / total) * 100} label={t('coverage')} />
        </div>
        <Button
          type="button"
          variant="outline"
          aria-expanded={slicing}
          onClick={() => setSlicing((open) => !open)}
        >
          <Split className="size-4" aria-hidden />
          {t('slice')}
        </Button>
      </div>

      <Notes notes={setNotes} />

      {slicing && (
        <SlicePanel
          exercise={exercise}
          exerciseId={exerciseId}
          sources={sources}
          onChange={onChange}
          onClose={() => setSlicing(false)}
        />
      )}

      {exercise.pairs.map((pair, index) => {
        const filled = filledWords(pair);
        const voices = voicesOf(pair);
        const spread = pairSpread(pair);
        const family = pairContrast(exercise, pair);
        const recorded = filled.filter((w) => hasClip(w.clip));
        const allRecorded = filled.length > 1 && recorded.length === filled.length;
        const playable = allRecorded && recorded.every((w) => urlOf(w.clip.assetId) !== '');
        const firstDialect = recorded[0]?.clip.dialect ?? '';
        const pairNotes: Note[] = found
          .filter((issue) => issue.code === 'MP_CLIP_TOO_LONG' && issue.pairId === pair.id)
          .map((issue, i) => ({
            key: `${issue.code}-${i}`,
            level: issue.level,
            text: copy.describe(issue),
          }));

        return (
          <PairCard
            key={pair.id}
            index={index}
            title={filled.map((w) => w.text).join(' · ') || tm('step1.newPair')}
            bad={filled.some((w) => !hasClip(w.clip)) || voices.length > 1}
            head={
              <>
                <span className="flex-1" />
                {allRecorded && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!playable}
                    onClick={() =>
                      void clips.sequence(
                        filled.map((w) => ({ id: w.id, url: urlOf(w.clip.assetId) })),
                      )
                    }
                  >
                    <Shuffle className="size-4" aria-hidden />
                    {t('hearAB')}
                  </Button>
                )}
              </>
            }
          >
            {pair.words.map((word, wi) => {
              if (word.text.trim() === '') return null;
              const ref: WordRef = { pairId: pair.id, wordId: word.id, text: word.text };
              return (
                <ClipRow
                  key={word.id}
                  word={word}
                  index={wi}
                  asset={hasClip(word.clip) ? assets.get(word.clip.assetId) : undefined}
                  maxMs={maxMs}
                  spreadWarn={spread > CLIP_LIMITS.warnDeltaMs}
                  activity={words.activity.get(word.id)}
                  failure={words.failures.get(word.id)}
                  micBusy={words.recording !== null}
                  levels={words.levels}
                  ttsBlocked={family?.tts === 'no'}
                  playing={clips.playing(word.id)}
                  onPlay={() =>
                    clips.playing(word.id)
                      ? clips.stop()
                      : void clips.play({ id: word.id, url: urlOf(word.clip.assetId) })
                  }
                  onRecord={() => words.record(ref)}
                  onStop={words.stop}
                  onUpload={() => {
                    uploadFor.current = ref;
                    fileInput.current?.click();
                  }}
                  onSynthesize={() => words.synthesize(ref)}
                  onRemove={() => onChange(clearClip(exercise, pair.id, word.id))}
                />
              );
            })}

            {voices.length > 1 && (
              <Callout tone="warn">
                {t.rich('mixedVoices', {
                  voices: voices.join(' / '),
                  b: (chunks) => <b>{chunks}</b>,
                })}
                <div className="mt-2 flex flex-wrap gap-2">
                  {recorded.map((w) => (
                    <Button
                      key={w.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        onChange(relabelVoice(exercise, pair.id, w.clip.voice, w.clip.provenance))
                      }
                    >
                      {t('useVoice', { voice: w.clip.voice.trim() || w.clip.provenance })}
                    </Button>
                  ))}
                </div>
              </Callout>
            )}

            {spread > CLIP_LIMITS.warnDeltaMs && (
              <p role="alert" className="m-0 text-xs text-(--ssz-color-error-700)">
                {t('spread', { ms: spread })}
              </p>
            )}

            {family?.needsDialect === true && recorded.length > 0 && (
              <Field
                label={t('dialectLabel')}
                message={{ tone: 'hint', text: t('dialectHint'), id: `mp-dialect-${pair.id}-help` }}
              >
                <Segmented
                  size="sm"
                  aria-label={t('dialectLabel')}
                  value={firstDialect === '' ? NO_DIALECT : firstDialect}
                  onValueChange={(value) =>
                    onChange(setDialect(exercise, pair.id, value === NO_DIALECT ? '' : value))
                  }
                  options={[
                    { value: NO_DIALECT, label: t('dialectNone') },
                    ...dialects.map((d) => ({ value: d.id, label: d.label })),
                  ]}
                />
              </Field>
            )}

            <Notes notes={pairNotes} />
          </PairCard>
        );
      })}

      <PolicyCard
        exercise={exercise}
        family={exerciseContrast(exercise)}
        inSet={contrastsInSet(exercise)
          .map((id) => contrastsOf(exercise.language).find((c) => c.id === id))
          .filter((c): c is ContrastFamily => c !== undefined)}
      />

      <input
        ref={fileInput}
        type="file"
        accept="audio/*"
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          const target = uploadFor.current;
          event.target.value = '';
          uploadFor.current = null;
          if (file !== undefined && target !== null) words.upload(target, file);
        }}
      />
    </div>
  );
}

/**
 * «Synthetic speech policy» — the exercise family's rule in full; a set mixing families gets a
 * paragraph per family, since the rule is applied per pair (§4.2 p. 2).
 */
function PolicyCard({
  exercise,
  family,
  inSet,
}: {
  exercise: MinimalPairsDocument;
  family: ContrastFamily | undefined;
  inSet: ContrastFamily[];
}) {
  const t = useTranslations('Authoring.minimalPairs.step2');
  if (family === undefined) return null;
  const mixed = inSet.length > 1;

  return (
    <Card
      icon={Wand2}
      title={t('policyTitle')}
      note={<TtsChip tts={family.tts}>{family.label}</TtsChip>}
      labelledBy={`mp-policy-${exercise.contrastId}`}
    >
      {mixed ? (
        inSet.map((c) => (
          <p key={c.id} className="m-0 text-sm text-(--ssz-text-secondary)">
            {t.rich('policyFamily', {
              label: c.label,
              text: t(`policy.${c.tts}`),
              b: (chunks) => <b>{chunks}</b>,
            })}
          </p>
        ))
      ) : (
        <p className="m-0 text-sm text-(--ssz-text-secondary)">{t(`policy.${family.tts}`)}</p>
      )}
    </Card>
  );
}
