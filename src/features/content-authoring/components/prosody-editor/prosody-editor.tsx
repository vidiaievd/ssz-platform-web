'use client';

import { useTranslations } from 'next-intl';
import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';

import {
  MARKS_LEADING,
  ProsodyBoundary,
  ProsodyWord,
  drawnIn,
  marksByStart,
} from '@/features/student/prosody/prosody-text';
import {
  mergeProsody,
  type ProsodyAnchor,
  type ProsodyLayer,
  type WordStress,
} from '@/lib/shared-kernel/prosody';
import { splitSentences, type Sentence } from '@/lib/shared-kernel/text/sentences';
import { tokenize, type Token } from '@/lib/shared-kernel/text/words';
import { cn } from '@/lib/utils';

import {
  accentOn,
  boundaryOn,
  clearPhrase,
  cyclePause,
  setAccent,
  setBoundary,
} from './layer-edits';
import { WordCard } from './word-card';

/** What the author still has to settle, as the owner's checks found it. */
export type EditorNeed =
  /** A word the dictionary left without the stress it should carry. */
  | { kind: 'word'; i: number }
  /** A sentence (index of `splitSentences`) with no end of a group on its last word. */
  | { kind: 'end'; sentence: number };

export interface ProsodyEditorProps {
  /** The passage as stored; the layer's anchors count its tokens. */
  text: string;
  /** The authored layer — what the author set; the dictionary's words are not in it. */
  layer: ProsodyLayer;
  lexicon: { stresses: readonly WordStress[]; unresolved: readonly ProsodyAnchor[] };
  needs: readonly EditorNeed[];
  onChange: (layer: ProsodyLayer) => void;
  lang?: string;
}

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;

/**
 * The marks of one passage, «Visually» (plan 86, §4i.4, step 6h.3b): the sentences with their
 * status on the left, the chosen sentence large as the learner sees it in «Melody» (variant C)
 * on the right, and the card of the word picked in it.
 *
 * The dictionary's stress is drawn under the author's marks (`mergeProsody`) and never edited
 * as such: the card replaces it on one word, or sets «no stress». A click on a gap between
 * words cycles the pause after the word before it — the most common edit, one press. The
 * owner (the read_aloud builder, later the lesson editor) holds the layer and saves it.
 */
export function ProsodyEditor({ text, layer, lexicon, needs, onChange, lang }: ProsodyEditorProps) {
  const t = useTranslations('Authoring.prosodyEditor');
  const tokens = useMemo(() => tokenize(text), [text]);
  const sentences = useMemo(() => splitSentences(text, tokens), [text, tokens]);
  const merged = useMemo(() => mergeProsody(lexicon.stresses, layer), [lexicon.stresses, layer]);
  const marks = useMemo(() => marksByStart(text, merged), [text, merged]);

  const [pickedSentence, setSentence] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  // A shorter passage after an edit of the text must not leave the editor on a gone sentence.
  const at = pickedSentence < sentences.length ? pickedSentence : 0;
  const sentence = sentences[at];
  const selected =
    picked !== null && sentence && picked >= sentence.first && picked < sentence.end
      ? tokens[picked]
      : undefined;

  const needsOf = (s: Sentence) =>
    needs.filter((n) => (n.kind === 'end' ? n.sentence === s.index : n.i >= s.first && n.i < s.end))
      .length;
  const wordNeeded = new Set(needs.flatMap((n) => (n.kind === 'word' ? [n.i] : [])));

  if (sentence === undefined) return null;

  const onWordKey = (event: KeyboardEvent, token: Token) => {
    const apply = (next: ProsodyLayer) => {
      event.preventDefault();
      setPicked(token.i);
      onChange(next);
    };
    switch (event.key) {
      case 'Enter':
        // The first press picks the word, the next one toggles it as the main word.
        if (picked !== token.i) {
          event.preventDefault();
          setPicked(token.i);
          return;
        }
        return apply(setAccent(layer, token, !accentOn(layer, token)));
      case '.':
        return apply(setBoundary(layer, token, { pitch: 'fall', pause: 'long' }));
      case '?':
        return apply(setBoundary(layer, token, { pitch: 'rise', pause: 'long' }));
      case ',':
        return apply(setBoundary(layer, token, { pause: 'short' }));
      case 'Delete':
      case 'Backspace':
        return apply(clearPhrase(layer, token));
    }
  };

  const canvas: ReactNode[] = [];
  let from = sentence.s;
  for (let k = sentence.first; k < sentence.end; k++) {
    const token = tokens[k]!;
    const between = text.slice(from, token.s);
    from = token.e;
    if (k > sentence.first) {
      const before = tokens[k - 1]!;
      const punctuation = between.replace(/\s+/g, '');
      if (punctuation !== '') canvas.push(punctuation);
      canvas.push(
        <button
          key={`g${k}`}
          type="button"
          data-gap=""
          aria-label={t('gapLabel', { word: before.w })}
          title={t('gapLabel', { word: before.w })}
          onClick={() => onChange(cyclePause(layer, before))}
          className="relative inline-block h-[1.1em] w-[0.55em] cursor-pointer rounded-[3px] align-[-0.15em] hover:bg-[color-mix(in_srgb,var(--ssz-color-warning-600)_18%,transparent)] focus-visible:outline-2 focus-visible:outline-(--ssz-color-primary-600)"
        >
          {/* The space itself, so the sentence reads and copies as written. */}
          {'\u00a0'}
        </button>,
      );
    } else if (between.trim() !== '') {
      canvas.push(between.trim());
    }

    const here = marks.get(token.s);
    const boundary = here?.boundary;
    canvas.push(
      <button
        key={`w${k}`}
        type="button"
        data-token={k}
        aria-pressed={selected?.i === k}
        onClick={() => setPicked(k)}
        onKeyDown={(event) => onWordKey(event, token)}
        className={cn(
          'relative inline-block cursor-pointer rounded px-px focus-visible:outline-2 focus-visible:outline-(--ssz-color-primary-600)',
          'hover:bg-[color-mix(in_srgb,var(--ssz-color-primary-600)_10%,transparent)]',
          selected?.i === k && 'bg-(--ssz-color-primary-50)',
          wordNeeded.has(k) && 'shadow-[inset_0_-2px_0_var(--ssz-color-warning-600)]',
        )}
        style={{ lineHeight: 1.25 }}
      >
        {here !== undefined && drawnIn('melody', here) ? (
          <ProsodyWord word={token.w} marks={here} view={{ lens: 'melody' }} />
        ) : (
          token.w
        )}
      </button>,
    );
    if (boundary !== undefined) canvas.push(<ProsodyBoundary key={`b${k}`} boundary={boundary} />);
  }
  const tail = text.slice(from, sentence.e).trim();
  if (tail !== '') canvas.push(tail);

  return (
    <div className="grid gap-4 md:grid-cols-[15rem_minmax(0,1fr)] md:items-start">
      <ol aria-label={t('sentencesLabel')} className="m-0 flex list-none flex-col gap-1 p-0">
        {sentences.map((s) => {
          const open = needsOf(s);
          const words = tokens.slice(s.first, Math.min(s.end, s.first + 5)).map((x) => x.w);
          return (
            <li key={s.index}>
              <button
                type="button"
                aria-current={s.index === at ? 'true' : undefined}
                onClick={() => {
                  setSentence(s.index);
                  setPicked(null);
                }}
                className={cn(
                  'grid w-full grid-cols-[1.5em_minmax(0,1fr)_auto] items-baseline gap-1.5 rounded-(--ssz-radius-sm) px-2 py-1.5 text-left text-sm text-(--ssz-text-secondary)',
                  s.index === at && 'bg-(--ssz-color-primary-50) text-(--ssz-text-primary)',
                )}
              >
                <span className="text-xs tabular-nums">{s.index + 1}</span>
                <span className="truncate" style={READING}>
                  {words.join(' ')}
                  {s.end - s.first > 5 ? '…' : ''}
                </span>
                <span
                  className={cn(
                    'text-xs whitespace-nowrap',
                    open > 0 ? 'text-(--ssz-color-warning-700)' : 'text-(--ssz-color-success-700)',
                  )}
                >
                  {open > 0 ? t('sentenceNeeds', { count: open }) : t('sentenceOk')}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="flex min-w-0 flex-col gap-3">
        <p
          lang={lang}
          aria-label={t('canvasLabel', { n: at + 1 })}
          data-canvas=""
          className="m-0 text-2xl"
          style={{ ...READING, lineHeight: MARKS_LEADING + 0.2 }}
        >
          {canvas}
        </p>
        <p className="m-0 text-xs text-(--ssz-text-muted)">
          {t.rich('keysHint', {
            k: (chunk) => (
              <kbd className="rounded-[4px] border border-b-2 border-(--ssz-border-default) px-1 font-mono">
                {chunk}
              </kbd>
            ),
          })}
        </p>
        <div className="border-t border-(--ssz-border-default) pt-3">
          {selected === undefined ? (
            <p className="m-0 text-sm text-(--ssz-text-muted)">{t('pickWord')}</p>
          ) : (
            <WordCard
              token={selected}
              layer={layer}
              shown={merged.stresses.find((s) => s.i === selected.i)}
              lexicon={lexicon.stresses.find((s) => s.i === selected.i)}
              unknown={lexicon.unresolved.some((u) => u.i === selected.i)}
              boundary={boundaryOn(layer, selected)}
              accent={accentOn(layer, selected)}
              onChange={onChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
