'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Monitor, RotateCcw, Smartphone, Type } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import {
  MinimalPairsBody,
  MinimalPairsReaderCard,
  PRACTICE_ACCENT,
  useClipPlayer,
  useMinimalPairsSitting,
  type SittingDriver,
} from '@/features/student/exercises/runner';
import type {
  MinimalPairsProbe,
  MinimalPairsProbeVerdict,
  MinimalPairsSubmitDetails,
} from '@/features/student/exercises/types/attempts';
import {
  deal,
  filledWords,
  firstCorrect,
  judgePick,
  lcg,
  maxTries,
  probeNumber,
  readyPairs,
  revealOf,
  summarize,
  toContent,
  toProbeView,
  toStudentProjection,
  type DealtProbe,
  type MinimalPairsContent,
  type ProbeState,
} from '@/lib/shared-kernel/minimal-pairs';

import { browserClipSources, type ClipSources } from './clip-sources';
import type { MinimalPairsDocument } from './edits';

type Device = 'phone' | 'desktop' | 'reader';

export interface MinimalPairsPreviewProps {
  exercise: MinimalPairsDocument;
  /** Where the author's clips are read from. Tests pass a fake; the builder uses the network's. */
  sources?: Pick<ClipSources, 'describe'>;
}

/**
 * The student's view of the exercise being built — the runner's own body, not a lookalike
 * (MP-B29), fed through `toStudentProjection`, which is what drops the pairs, the clips and the
 * pass mark (plan 72 §7.8).
 *
 * Three devices — phone, desktop (one column, centred) and the reader's card — and *Static* (the
 * first probe drawn, nothing plays, nothing accepts input, nothing is fetched) or *Live*. Live is
 * a local sitting: the kernel's sampler deals it and the kernel's judge marks it, over the
 * author's own clips, and **nothing leaves the browser** — no attempt exists, so nothing is
 * recorded anywhere and no evidence is written. «Restart» draws again.
 */
export function MinimalPairsPreview({
  exercise,
  sources = browserClipSources,
}: MinimalPairsPreviewProps) {
  const t = useTranslations('Authoring.minimalPairs.preview');

  const [device, setDevice] = useState<Device>('phone');
  const [mode, setMode] = useState<'static' | 'live'>('static');
  /** Bumped by «restart» and by a change of what the student would be handed or dealt. */
  const [epoch, setEpoch] = useState(0);

  const content = useMemo(() => toContent(exercise), [exercise]);
  const projection = useMemo(() => toStudentProjection(content), [content]);

  /*
    When what the student is handed or dealt changes, the run starts again — during render, not
    in an effect, so no frame shows a probe of a set that just changed. The words' spelling and
    the pair notes are not in the signature on purpose: retyping a gloss must not throw away a
    sitting the author is in the middle of; the driver reads the latest document for them.
  */
  const signature = JSON.stringify([
    projection,
    content.set,
    content.pairs.map((p) => [p.id, p.words.map((w) => [w.id, w.clip.assetId, w.text !== ''])]),
  ]);
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setEpoch((n) => n + 1);
  }

  const restart = () => setEpoch((n) => n + 1);
  const playable = readyPairs(exercise).length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-(--ssz-border-default) px-3 py-2">
        <Eye size={15} aria-hidden="true" className="text-(--ssz-text-muted)" />
        <strong className="text-xs font-bold tracking-wide text-(--ssz-text-muted) uppercase">
          {device === 'phone' ? t('phone') : device === 'desktop' ? t('desktop') : t('reader')}
        </strong>
        <span className="flex-1" />
        <Segmented<Device>
          aria-label={t('deviceLabel')}
          size="sm"
          iconOnly
          value={device}
          onValueChange={setDevice}
          options={[
            { value: 'phone', label: t('phone'), icon: Smartphone },
            { value: 'desktop', label: t('desktop'), icon: Monitor },
            { value: 'reader', label: t('reader'), icon: Type },
          ]}
        />
        <Segmented<'static' | 'live'>
          aria-label={t('modeLabel')}
          size="sm"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'static', label: t('static') },
            { value: 'live', label: t('live') },
          ]}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('restart')}
          title={t('restart')}
          onClick={restart}
        >
          <RotateCcw className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-4">
        <div className="py-4">
          {device === 'reader' ? (
            <div className="mx-auto max-w-[390px]">
              <MinimalPairsReaderCard
                projection={projection}
                title={exercise.title}
                interactive={mode === 'live'}
                onStart={() => setDevice('phone')}
                accent={PRACTICE_ACCENT}
              />
            </div>
          ) : !playable ? (
            <p className="m-0 text-sm text-(--ssz-text-muted)">{t('empty')}</p>
          ) : (
            <div className={device === 'desktop' ? undefined : 'mx-auto max-w-[390px]'}>
              <PreviewRun
                // A new sitting for every restart; the layout is only a prop.
                key={`${epoch}:${mode}`}
                exercise={exercise}
                projection={projection}
                layout={device}
                live={mode === 'live'}
                seed={epoch + 7}
                sources={sources}
                onRestart={restart}
              />
            </div>
          )}
        </div>
      </div>
      <p className="m-0 px-4 pb-3 text-[11px] text-(--ssz-text-muted)">
        {mode === 'live' ? t('noteLive') : t('noteStatic')}
      </p>
    </div>
  );
}

interface RunProps {
  exercise: MinimalPairsDocument;
  projection: ReturnType<typeof toStudentProjection>;
  layout: 'phone' | 'desktop';
  live: boolean;
  seed: number;
  sources: Pick<ClipSources, 'describe'>;
  onRestart: () => void;
}

/** One sitting at the author's own clips — and the player and the local draw it owns. */
function PreviewRun({ exercise, projection, layout, live, seed, sources, onRestart }: RunProps) {
  const clips = useClipPlayer();

  const [driver] = useState(() => createLocalDriver({ document: exercise, live, seed, sources }));
  // The latest document, for the spellings and glosses a sitting reads after it was dealt.
  useEffect(() => {
    driver.track(exercise);
  });

  const sitting = useMinimalPairsSitting({
    driver,
    clips,
    playsPerProbe: projection.set.playsPerProbe,
    // A static preview never plays; a live one behaves as the student's does.
    autoplay: live && projection.set.autoplay,
  });

  // The first probe, once per mount — as the reader's solver does.
  const begun = useRef(false);
  const beginSitting = sitting.begin;
  useEffect(() => {
    if (begun.current) return;
    begun.current = true;
    beginSitting();
  }, [beginSitting]);

  return (
    <MinimalPairsBody
      projection={projection}
      sitting={sitting}
      clips={clips}
      layout={layout}
      interactive={live}
      onRestart={onRestart}
      accent={PRACTICE_ACCENT}
    />
  );
}

interface LocalDriverOptions {
  document: MinimalPairsContent;
  /** False in the static preview: no clip is looked up, every link is empty. */
  live: boolean;
  seed: number;
  sources: Pick<ClipSources, 'describe'>;
}

/**
 * The engine's three commands over the kernel, in the browser (plan 72 §7.8).
 *
 * The draw is made on the first `next` and kept; a probe is the kernel's `toProbeView` and a
 * verdict its `judgePick` and `revealOf`, so what the preview does is what the server does, with
 * the builder's own random source in place of the engine's. The author's clips are looked up the
 * way the builder looks them up; an asset that is not playable yet comes back with an empty link
 * and the body treats a refused play as no spent listen.
 */
export function createLocalDriver({
  document,
  live,
  seed,
  sources,
}: LocalDriverOptions): SittingDriver & { track(document: MinimalPairsContent): void } {
  let latest = document;
  let draw: DealtProbe[] | null = null;
  const states = new Map<number, ProbeState>();

  const urlOf = async (assetId: string): Promise<string> => {
    if (!live || assetId === '') return '';
    try {
      const asset = await sources.describe(assetId);
      return asset.status === 'ready' ? asset.url : '';
    } catch {
      return '';
    }
  };

  const dealt = (): DealtProbe[] => (draw ??= deal(latest, lcg(seed)));
  const tries = () => maxTries(latest.feedback, false);
  const current = (): DealtProbe | undefined => dealt().find((p) => !states.get(p.n)?.closed);

  return {
    track(next) {
      latest = next;
    },

    async next() {
      const ex = latest;
      const probe = current();
      if (probe === undefined) return 'closed';
      const view = toProbeView(ex, probe, dealt().length);
      if (view === null) throw new Error('A probe of a word that is gone');
      const picks = states.get(probe.n)?.picks.length ?? 0;
      const handed: MinimalPairsProbe = {
        n: view.n,
        total: view.total,
        questionId: view.questionId,
        clip: {
          url: await urlOf(view.clip.assetId),
          expiresAt: '',
          durationMs: view.clip.durationMs,
          provenance: view.clip.provenance,
          dialect: view.clip.dialect,
        },
        options: view.options,
        state: { tries: picks, maxTries: tries(), closed: false },
        closedProbes: dealt().flatMap((p) => {
          const state = states.get(p.n);
          return state?.closed === true ? [{ n: p.n, correct: firstCorrect(p, state) }] : [];
        }),
      };
      return handed;
    },

    async answer(questionId, optionId) {
      const ex = latest;
      const probe = current();
      if (probe === undefined || probeNumber(questionId) !== probe.n) {
        throw new Error('Not the current probe');
      }
      const judged = judgePick(probe, states.get(probe.n), optionId, tries());
      if ('refused' in judged) throw new Error(judged.refused);
      states.set(probe.n, judged.next);

      const verdict: MinimalPairsProbeVerdict = {
        questionId,
        n: probe.n,
        optionId,
        correct: judged.verdict.correct,
        closed: judged.verdict.closed,
        tries: judged.next.picks.length,
        triesLeft: Math.max(0, tries() - judged.next.picks.length),
        firstCorrect: firstCorrect(probe, judged.next),
      };
      if (!judged.verdict.closed) return verdict;

      const reveal = revealOf(ex, probe, optionId);
      verdict.keyOptionId = reveal.keyOptionId;
      verdict.options = reveal.options;
      if (reveal.compare !== undefined) {
        const [chosen, target] = await Promise.all([
          urlOf(reveal.compare.chosenAssetId),
          urlOf(reveal.compare.targetAssetId),
        ]);
        verdict.compare = { chosen, target };
      }
      return verdict;
    },

    async finish() {
      const ex = latest;
      const summary = summarize(ex, dealt(), [...states.values()]);
      const pairs = await Promise.all(
        summary.pairs.map(async (pair) => {
          const source = ex.pairs.find((p) => p.id === pair.pairId);
          const links = await Promise.all(
            (source === undefined ? [] : filledWords(source)).map((w) => urlOf(w.clip.assetId)),
          );
          return { ...pair, clips: links };
        }),
      );
      const details: MinimalPairsSubmitDetails = {
        right: summary.right,
        total: summary.total,
        score: summary.score,
        passed: summary.passed,
        passPct: summary.passPct,
        memory: summary.memory,
        pairs,
      };
      return details;
    },
  };
}
