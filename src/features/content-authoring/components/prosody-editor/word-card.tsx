'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode } from 'react';

import type {
  GroupBoundary,
  GroupPause,
  GroupPitch,
  ProsodyLayer,
  Toneme,
  WordStress,
} from '@/lib/shared-kernel/prosody';
import type { Token } from '@/lib/shared-kernel/text/words';
import { cn } from '@/lib/utils';

import {
  revertWord,
  setAccent,
  setBoundary,
  setStress,
  setUnstressed,
  stressFor,
  vowelNuclei,
  wordAnswered,
} from './layer-edits';

export interface WordCardProps {
  token: Token;
  /** The authored layer the card edits. */
  layer: ProsodyLayer;
  /** The stress the learner sees on the word: the author's, else the dictionary's. */
  shown: WordStress | undefined;
  /** The dictionary's stress of the word, if it gave one. */
  lexicon: WordStress | undefined;
  /** The dictionary has no reading of the word that would carry a stress (a name, two readings). */
  unknown: boolean;
  boundary: GroupBoundary | undefined;
  accent: boolean;
  onChange: (layer: ProsodyLayer) => void;
}

/**
 * The card of the word picked in the editor (plan 86, §4i.4): its phrase marks — the main word
 * of the group, the voice and the pause at a group end after it — and its stress. The stress is
 * the dictionary's to give; the card changes it only where the dictionary is wrong or silent,
 * and «Back to the dictionary» undoes that.
 */
export function WordCard({
  token,
  layer,
  shown,
  lexicon,
  unknown,
  boundary,
  accent,
  onChange,
}: WordCardProps) {
  const t = useTranslations('Authoring.prosodyEditor');
  const answered = wordAnswered(layer, token);
  const nuclei = vowelNuclei(token.w);
  const letters = (s: WordStress) => token.w.slice(s.vowel.s, s.vowel.e);

  const note =
    answered === 'unstressed'
      ? t('noteUnstressed')
      : answered === 'stress'
        ? t('noteAuthored')
        : unknown
          ? t('noteUnknown')
          : lexicon === undefined
            ? t('noteNoStress')
            : lexicon.toneme === null
              ? t('noteMono', { vowel: letters(lexicon) })
              : t('noteTone', { toneme: lexicon.toneme, vowel: letters(lexicon) });

  const pitch = boundary?.pitch ?? null;
  const pause = boundary?.pause ?? null;
  const vowelValue =
    answered === 'unstressed' ? 'none' : shown === undefined ? null : `${shown.vowel.s}`;

  return (
    <section aria-label={t('cardLabel', { word: token.w })} className="flex flex-col gap-3">
      <div>
        <h3 className="m-0 text-xl" style={{ fontFamily: 'var(--ssz-font-reading)' }}>
          {token.w}
        </h3>
        <p className="m-0 text-sm text-(--ssz-text-muted)">{note}</p>
      </div>

      <Choices
        label={t('accentLabel')}
        value={accent}
        options={[
          [true, t('yes')],
          [false, t('no')],
        ]}
        onPick={(on) => onChange(setAccent(layer, token, on))}
      />
      <Choices<GroupPitch | null>
        label={t('pitchLabel')}
        value={pitch}
        options={[
          ['fall', t('pitchFall')],
          ['rise', t('pitchRise')],
          ['level', t('pitchLevel')],
          [null, t('pitchNone')],
        ]}
        onPick={(next) =>
          // An end the author gives a pitch to is an end with a pause, unless they set another.
          onChange(
            setBoundary(layer, token, {
              pitch: next,
              pause: next !== null && pause === null ? 'long' : pause,
            }),
          )
        }
      />
      <Choices<GroupPause | null>
        label={t('pauseLabel')}
        value={pause}
        options={[
          ['short', t('pauseShort')],
          ['long', t('pauseLong')],
          [null, t('pauseNone')],
        ]}
        onPick={(next) => onChange(setBoundary(layer, token, { pause: next }))}
      />
      {nuclei.length > 0 && (
        <Choices<string | null>
          label={lexicon === undefined ? t('vowelLabel') : t('vowelLabelKnown')}
          value={vowelValue}
          options={[
            ...nuclei.map((v): [string, ReactNode] => [`${v.s}`, token.w.slice(v.s, v.e)]),
            ['none', t('unstressed')],
          ]}
          onPick={(next) => {
            if (next === 'none') return onChange(setUnstressed(layer, token));
            const vowel = nuclei.find((v) => `${v.s}` === next);
            if (vowel === undefined) return;
            const stress = stressFor(token.w, vowel, shown, lexicon);
            onChange(setStress(layer, token, stress.vowel, stress.toneme));
          }}
        />
      )}
      {shown !== undefined && answered !== 'unstressed' && nuclei.length > 1 && (
        <Choices<Toneme | null>
          label={t('tonemeLabel')}
          value={shown.toneme}
          options={[
            [1, t('tone1')],
            [2, t('tone2')],
          ]}
          onPick={(toneme) => onChange(setStress(layer, token, shown.vowel, toneme))}
        />
      )}
      {answered !== null && (
        <div>
          <button
            type="button"
            onClick={() => onChange(revertWord(layer, token))}
            className="rounded-(--ssz-radius-sm) border border-(--ssz-border-default) px-2.5 py-1 text-sm"
          >
            {t('revert')}
          </button>
        </div>
      )}
    </section>
  );
}

function Choices<T>({
  label,
  value,
  options,
  onPick,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, ReactNode]>;
  onPick: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="text-xs text-(--ssz-text-muted)">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map(([option, text]) => (
          <button
            key={String(option)}
            type="button"
            aria-pressed={option === value}
            onClick={() => onPick(option)}
            className={cn(
              'rounded-(--ssz-radius-sm) border px-2.5 py-1 text-sm',
              option === value
                ? 'border-(--ssz-color-primary-600) bg-(--ssz-color-primary-600) text-white'
                : 'border-(--ssz-border-default)',
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
