'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import type { GroupBoundary, SoundSeg, WordStress } from '@/lib/shared-kernel/prosody';

import { ProsodyBoundary, ProsodyWord, type ProsodyLens, type TokenMarks } from './prosody-text';

// The signs of the lens in use (plan 86, §4i.3). Every sample is drawn by the very component
// that draws it in the text, so the legend cannot drift from what it explains.

const stress = (word: string, s: number, e: number, toneme: 1 | 2 | null, long: boolean): WordStress => ({
  i: 0,
  w: word,
  toneme,
  vowel: { s, e, long },
  source: 'lexicon',
});

const seg = (s: number, e: number, patch: Partial<SoundSeg>): SoundSeg => ({
  s,
  e,
  kind: 'consonant',
  sounds: [],
  stress: null,
  long: null,
  tie: false,
  ...patch,
});

// tunge → T OH2 NG AX0, godt → G OH1 T with a silent d.
const TUNGE: SoundSeg[] = [
  seg(0, 1, { sounds: ['T'] }),
  seg(1, 2, { kind: 'vowel', sounds: ['OH'], stress: 2, long: false }),
  seg(2, 4, { sounds: ['NG'], tie: true }),
  seg(4, 5, { kind: 'vowel', sounds: ['AX'], stress: 0, long: false }),
];
const GODT: SoundSeg[] = [
  seg(0, 1, { sounds: ['G'] }),
  seg(1, 2, { kind: 'vowel', sounds: ['OH'], stress: 1, long: false }),
  seg(2, 3, { kind: 'silent' }),
  seg(3, 4, { sounds: ['T'] }),
];

function Sample({ word, marks, lens }: { word: string; marks: Omit<TokenMarks, 'word'>; lens: ProsodyLens }) {
  return (
    <span className="inline-block px-1" style={{ lineHeight: 2.4 }}>
      <ProsodyWord word={word} marks={{ word, ...marks }} view={{ lens }} />
    </span>
  );
}

function Row({ sample, label }: { sample: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="min-w-14 text-center">{sample}</span>
      <span className="text-xs text-(--ssz-text-secondary)">{label}</span>
    </li>
  );
}

const boundary = (pitch: GroupBoundary['pitch'], pause: GroupBoundary['pause']): GroupBoundary => ({
  i: 0,
  w: 'x',
  pitch,
  pause,
  source: 'teacher',
});

/** The legend of one lens, in the learner's interface language. */
export function ProsodyLegend({ lens }: { lens: ProsodyLens }) {
  const t = useTranslations('ExerciseRunner.prosody');
  return (
    <section aria-label={t('legendTitle')} data-legend={lens} className="text-sm">
      <h4 className="mb-1 text-xs font-semibold text-(--ssz-text-muted) uppercase">
        {t('legendTitle')}
      </h4>
      <ul className="flex flex-col gap-0.5">
        {lens === 'stress' && (
          <>
            <Row
              sample={<Sample lens={lens} word="tunge" marks={{ stress: stress('tunge', 1, 2, 2, false) }} />}
              label={t('legendStressed')}
            />
            <Row
              sample={<Sample lens={lens} word="hus" marks={{ stress: stress('hus', 1, 2, null, true) }} />}
              label={t('legendLong')}
            />
          </>
        )}
        {lens === 'sounds' && (
          <>
            <Row sample={<Sample lens={lens} word="godt" marks={{ sounds: GODT }} />} label={t('legendSilent')} />
            <Row sample={<Sample lens={lens} word="tunge" marks={{ sounds: TUNGE }} />} label={t('legendTie')} />
            <Row sample={<Sample lens={lens} word="tunge" marks={{ sounds: TUNGE }} />} label={t('legendWeak')} />
          </>
        )}
        {lens === 'respell' && (
          <>
            <Row sample={<Sample lens={lens} word="tunge" marks={{ sounds: TUNGE }} />} label={t('legendRespell')} />
            <Row sample={<span className="font-mono">ŋ · ː</span>} label={t('legendRespellSigns')} />
          </>
        )}
        {lens === 'melody' && (
          <>
            <Row sample={<Sample lens={lens} word="heter" marks={{ stress: stress('heter', 1, 2, 1, true) }} />} label={t('legendTone1')} />
            <Row sample={<Sample lens={lens} word="Anna" marks={{ stress: stress('Anna', 0, 1, 2, false) }} />} label={t('legendTone2')} />
            <Row sample={<Sample lens={lens} word="norsk" marks={{ stress: stress('norsk', 1, 2, null, false) }} />} label={t('legendDot')} />
            <Row
              sample={
                <Sample
                  lens={lens}
                  word="Anna"
                  marks={{ stress: stress('Anna', 0, 1, 2, false), accent: { i: 0, w: 'Anna', source: 'teacher' } }}
                />
              }
              label={t('legendAccent')}
            />
            <Row
              sample={<span>ord<ProsodyBoundary boundary={boundary('fall', 'long')} /></span>}
              label={t('legendFall')}
            />
            <Row
              sample={<span>ord<ProsodyBoundary boundary={boundary('rise', 'short')} /></span>}
              label={t('legendRise')}
            />
          </>
        )}
      </ul>
    </section>
  );
}
