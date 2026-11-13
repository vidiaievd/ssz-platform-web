'use client';

import { useTranslations } from 'next-intl';
import { Loader2, Sparkles } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  MARKS_LEADING,
  ProsodyBoundary,
  ProsodyWord,
  drawnIn,
  marksByStart,
  type TokenMarks,
} from '@/features/student/prosody/prosody-text';
import {
  mergeProsody,
  type ProsodyAnchor,
  type ProsodyLayer,
  type ProsodyOrphan,
  type WordStress,
} from '@/lib/shared-kernel/prosody';
import { splitSentences, type Sentence } from '@/lib/shared-kernel/text/sentences';
import { tokenize, type Token } from '@/lib/shared-kernel/text/words';
import { cn } from '@/lib/utils';

import type { SuggestionRefusal } from '../../actions/prosody';
import {
  accentOn,
  boundaryOn,
  clearPhrase,
  cyclePause,
  dropOrphan,
  placeOrphan,
  setAccent,
  setBoundary,
} from './layer-edits';
import { NotationView, type TextIn } from './notation-view';
import { acceptIn, differsIn } from './suggestion';
import { WordCard } from './word-card';

/** What the author still has to settle, as the owner's checks found it. */
export type EditorNeed =
  /** A word the dictionary left without the stress it should carry. */
  | { kind: 'word'; i: number }
  /** A sentence (index of `splitSentences`) with no end of a group on its last word. */
  | { kind: 'end'; sentence: number };

/** The owner's answer to ✦: the proposed layer over the text it was made for. */
export type ProsodySuggestion =
  | { status: 'suggested'; text: string; layer: ProsodyLayer }
  | { status: 'refused'; reason: SuggestionRefusal }
  | { status: 'failed' };

export interface ProsodyEditorProps {
  /** The passage as stored; the layer's anchors count its tokens. */
  text: string;
  /** The authored layer — what the author set; the dictionary's words are not in it. */
  layer: ProsodyLayer;
  lexicon: { stresses: readonly WordStress[]; unresolved: readonly ProsodyAnchor[] };
  needs: readonly EditorNeed[];
  onChange: (layer: ProsodyLayer) => void;
  /** ✦ Ask the authoring agent for phrase marks. Absent — no button (no `ai.authoring`). */
  onSuggest?: () => Promise<ProsodySuggestion>;
  lang?: string;
  /** Where the words are edited, for the «As text» mismatch; the builder's step 1 by default. */
  textIn?: TextIn;
  /**
   * Which sentences the author is offered; all by default. A lesson body hides its lines of
   * media tokens. Hidden sentences keep their marks and their place in the numbering of needs.
   */
  showSentence?: (sentence: Sentence) => boolean;
}

type SuggestState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; text: string; layer: ProsodyLayer; closed: readonly number[] }
  | { status: 'refused'; reason: SuggestionRefusal }
  | { status: 'failed' };

const READING = { fontFamily: 'var(--ssz-font-reading)' } as const;

const REFUSAL_KEYS: Record<
  SuggestionRefusal,
  | 'suggestRefusedLanguage'
  | 'suggestRefusedNoWords'
  | 'suggestRefusedTooLong'
  | 'suggestRefusedNotAvailable'
  | 'suggestRefusedPoolEmpty'
> = {
  language_not_supported: 'suggestRefusedLanguage',
  no_words: 'suggestRefusedNoWords',
  too_long: 'suggestRefusedTooLong',
  not_available: 'suggestRefusedNotAvailable',
  pool_empty: 'suggestRefusedPoolEmpty',
};

/**
 * The marks of one passage (plan 86, §4i.4), in two views.
 *
 * «Visually» (step 6h.3b): the sentences with their status on the left, the chosen sentence
 * large as the learner sees it in «Melody» (variant C) on the right, and the card of the word
 * picked in it. The dictionary's stress is drawn under the author's marks (`mergeProsody`) and
 * never edited as such: the card replaces it on one word, or sets «no stress». A click on a gap
 * between words cycles the pause after the word before it — the most common edit, one press.
 *
 * «As text» (step 6h.3c): the author's marks in the notation, for those who write them faster
 * than they click. ✦ asks the agent for phrase marks; they are proposed sentence by sentence,
 * dashed in their own colour, and taken or dropped there. A mark whose words an edit of the
 * text removed (an orphan) waits above the sentence to be put back on a word or removed.
 *
 * The owner (the read_aloud builder, the lesson editor) holds the layer and saves it.
 */
export function ProsodyEditor({
  text,
  layer,
  lexicon,
  needs,
  onChange,
  onSuggest,
  lang,
  textIn,
  showSentence,
}: ProsodyEditorProps) {
  const t = useTranslations('Authoring.prosodyEditor');
  const tokens = useMemo(() => tokenize(text), [text]);
  const sentences = useMemo(() => {
    const all = splitSentences(text, tokens);
    return showSentence ? all.filter(showSentence) : all;
  }, [text, tokens, showSentence]);
  const merged = useMemo(() => mergeProsody(lexicon.stresses, layer), [lexicon.stresses, layer]);
  const marks = useMemo(() => marksByStart(text, merged), [text, merged]);

  const [mode, setMode] = useState<'visual' | 'text'>('visual');
  const [pickedSentence, setSentence] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  /** The orphan being put back: the next word clicked takes it. */
  const [placing, setPlacing] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestState>({ status: 'idle' });

  // A shorter passage after an edit of the text must not leave the editor on a gone sentence.
  const pos = Math.max(
    0,
    sentences.findIndex((s) => s.index === pickedSentence),
  );
  const sentence = sentences[pos];
  const at = sentence?.index;
  const selected =
    picked !== null && sentence && picked >= sentence.first && picked < sentence.end
      ? tokens[picked]
      : undefined;
  const orphanPlacing = placing !== null ? layer.orphans[placing] : undefined;

  // A suggestion is for the text it was made on; a new text leaves it behind.
  const proposal = suggestion.status === 'ready' && suggestion.text === text ? suggestion : null;
  const proposed = useMemo(
    () =>
      proposal === null
        ? new Set<number>()
        : new Set(
            sentences
              .filter(
                (s) => !proposal.closed.includes(s.index) && differsIn(layer, proposal.layer, s),
              )
              .map((s) => s.index),
          ),
    [proposal, sentences, layer],
  );

  const needsOf = (s: Sentence) =>
    needs.filter((n) => (n.kind === 'end' ? n.sentence === s.index : n.i >= s.first && n.i < s.end))
      .length;
  const wordNeeded = new Set(needs.flatMap((n) => (n.kind === 'word' ? [n.i] : [])));

  if (sentence === undefined) return null;

  const suggest = () => {
    if (!onSuggest) return;
    setSuggestion({ status: 'loading' });
    onSuggest()
      .then((answer) => {
        if (answer.status === 'suggested') {
          setSuggestion({ status: 'ready', text: answer.text, layer: answer.layer, closed: [] });
          setMode('visual');
        } else {
          setSuggestion(answer);
        }
      })
      .catch(() => setSuggestion({ status: 'failed' }));
  };

  const close = (indexes: readonly number[]) => {
    if (proposal === null) return;
    setSuggestion({ ...proposal, closed: [...proposal.closed, ...indexes] });
  };

  const accept = (targets: readonly Sentence[]) => {
    if (proposal === null) return;
    onChange(targets.reduce((next, s) => acceptIn(next, proposal.layer, s), layer));
    close(targets.map((s) => s.index));
  };

  const pickWord = (token: Token) => {
    if (placing !== null) {
      const next = placeOrphan(layer, placing, tokens, token.i);
      if (next === null) return;
      setPlacing(null);
      setPicked(token.i);
      onChange(next);
      return;
    }
    setPicked(token.i);
  };

  const onWordKey = (event: KeyboardEvent, token: Token) => {
    const apply = (next: ProsodyLayer) => {
      event.preventDefault();
      setPicked(token.i);
      onChange(next);
    };
    switch (event.key) {
      case 'Enter':
        // The first press picks the word, the next one toggles it as the main word.
        if (placing !== null || picked !== token.i) {
          event.preventDefault();
          pickWord(token);
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
      case 'Escape':
        if (placing !== null) {
          event.preventDefault();
          setPlacing(null);
        }
    }
  };

  const fits = (token: Token) =>
    orphanPlacing !== undefined &&
    orphanPlacing.mark.w.split(/\s+/)[0]?.toLowerCase() === token.w.toLowerCase();

  const canvas = drawSentence({
    text,
    tokens,
    sentence,
    marks,
    gap: (before, k) => (
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
        {' '}
      </button>
    ),
    word: (token, face) => (
      <button
        key={`w${token.i}`}
        type="button"
        data-token={token.i}
        aria-pressed={selected?.i === token.i}
        onClick={() => pickWord(token)}
        onKeyDown={(event) => onWordKey(event, token)}
        className={cn(
          'relative inline-block cursor-pointer rounded px-px focus-visible:outline-2 focus-visible:outline-(--ssz-color-primary-600)',
          'hover:bg-[color-mix(in_srgb,var(--ssz-color-primary-600)_10%,transparent)]',
          selected?.i === token.i && 'bg-(--ssz-color-primary-50)',
          wordNeeded.has(token.i) && 'shadow-[inset_0_-2px_0_var(--ssz-color-warning-600)]',
          fits(token) && 'outline-1 outline-(--ssz-color-primary-600) outline-dashed',
        )}
        style={{ lineHeight: 1.25 }}
      >
        {face}
      </button>
    ),
  });

  const proposalHere = proposal !== null && proposed.has(sentence.index);
  const preview = proposalHere
    ? drawSentence({
        text,
        tokens,
        sentence,
        marks: marksByStart(
          text,
          mergeProsody(lexicon.stresses, acceptIn(layer, proposal.layer, sentence)),
        ),
        gap: (_, k) => <span key={`g${k}`}> </span>,
        word: (token, face) => <span key={`w${token.i}`}>{face}</span>,
      })
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label={t('modeLabel')}
          className="inline-flex rounded-(--ssz-radius-sm) border border-(--ssz-border-default) p-0.5"
        >
          {(['visual', 'text'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setPlacing(null);
              }}
              className={cn(
                'rounded-[calc(var(--ssz-radius-sm)-2px)] px-3 py-1 text-sm text-(--ssz-text-secondary)',
                mode === m && 'bg-(--ssz-color-primary-50) text-(--ssz-text-primary)',
              )}
            >
              {m === 'visual' ? t('modeVisual') : t('modeText')}
            </button>
          ))}
        </div>
        {onSuggest && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={suggestion.status === 'loading'}
            onClick={suggest}
          >
            {suggestion.status === 'loading' ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            {t('suggest')}
          </Button>
        )}
      </div>

      <SuggestionLine
        state={suggestion}
        pending={proposed.size}
        stale={suggestion.status === 'ready' && suggestion.text !== text}
        onAcceptAll={() => accept(sentences.filter((s) => proposed.has(s.index)))}
        onRejectAll={() => close([...proposed])}
        onRetry={suggest}
      />

      {layer.orphans.length > 0 && (
        <Orphans
          orphans={layer.orphans}
          placing={placing}
          onPlace={(k) => {
            setMode('visual');
            setPlacing(placing === k ? null : k);
          }}
          onDrop={(k) => {
            if (placing === k) setPlacing(null);
            onChange(dropOrphan(layer, k));
          }}
        />
      )}

      {mode === 'text' ? (
        <NotationView text={text} layer={layer} onChange={onChange} lang={lang} textIn={textIn} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[15rem_minmax(0,1fr)] md:items-start">
          <ol aria-label={t('sentencesLabel')} className="m-0 flex list-none flex-col gap-1 p-0">
            {sentences.map((s, k) => {
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
                    <span className="text-xs tabular-nums">{k + 1}</span>
                    <span className="truncate" style={READING}>
                      {words.join(' ')}
                      {s.end - s.first > 5 ? '…' : ''}
                    </span>
                    <span
                      className={cn(
                        'text-xs whitespace-nowrap',
                        open > 0
                          ? 'text-(--ssz-color-warning-700)'
                          : 'text-(--ssz-color-success-700)',
                      )}
                    >
                      {proposed.has(s.index) && (
                        <span
                          className="me-1 text-(--ssz-color-info-700)"
                          title={t('sentenceProposed')}
                        >
                          ✦
                        </span>
                      )}
                      {open > 0 ? t('sentenceNeeds', { count: open }) : t('sentenceOk')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="flex min-w-0 flex-col gap-3">
            {orphanPlacing !== undefined && (
              <p
                role="status"
                className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm text-(--ssz-text-secondary)"
              >
                {t('orphanPick')}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => setPlacing(null)}
                >
                  {t('orphanCancel')}
                </Button>
              </p>
            )}
            <p
              lang={lang}
              aria-label={t('canvasLabel', { n: pos + 1 })}
              data-canvas=""
              className="m-0 text-2xl"
              style={{ ...READING, lineHeight: MARKS_LEADING + 0.2 }}
            >
              {canvas}
            </p>
            {preview !== null && (
              <section
                aria-label={t('proposalLabel')}
                className="flex flex-col gap-2 rounded-(--ssz-radius-sm) border border-dashed border-(--ssz-color-info-600) p-3"
              >
                <p className="m-0 flex items-center gap-1.5 text-xs font-medium text-(--ssz-color-info-700)">
                  <Sparkles className="size-3.5" aria-hidden />
                  {t('proposalLabel')}
                </p>
                <p
                  lang={lang}
                  data-proposal=""
                  className="m-0 text-xl"
                  style={{ ...READING, lineHeight: MARKS_LEADING + 0.2 }}
                >
                  {preview}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => accept([sentence])}>
                    {t('proposalAccept')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => close([sentence.index])}
                  >
                    {t('proposalReject')}
                  </Button>
                </div>
              </section>
            )}
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
      )}
    </div>
  );
}

/**
 * One sentence of the passage with its marks, «Melody» as the learner sees it, the agent's
 * marks told apart. Punctuation between words is kept; the gaps and the words are the caller's.
 */
function drawSentence({
  text,
  tokens,
  sentence,
  marks,
  gap,
  word,
}: {
  text: string;
  tokens: readonly Token[];
  sentence: Sentence;
  marks: Map<number, TokenMarks>;
  gap: (before: Token, k: number) => ReactNode;
  word: (token: Token, face: ReactNode) => ReactNode;
}): ReactNode[] {
  const out: ReactNode[] = [];
  let from = sentence.s;
  for (let k = sentence.first; k < sentence.end; k++) {
    const token = tokens[k]!;
    const between = text.slice(from, token.s);
    from = token.e;
    if (k > sentence.first) {
      const punctuation = between.replace(/\s+/g, '');
      if (punctuation !== '') out.push(punctuation);
      out.push(gap(tokens[k - 1]!, k));
    } else if (between.trim() !== '') {
      out.push(between.trim());
    }

    const here = marks.get(token.s);
    out.push(
      word(
        token,
        here !== undefined && drawnIn('melody', here) ? (
          <ProsodyWord word={token.w} marks={here} view={{ lens: 'melody' }} sourced />
        ) : (
          token.w
        ),
      ),
    );
    if (here?.boundary !== undefined) {
      out.push(<ProsodyBoundary key={`b${k}`} boundary={here.boundary} sourced />);
    }
  }
  const tail = text.slice(from, sentence.e).trim();
  if (tail !== '') out.push(tail);
  return out;
}

function SuggestionLine({
  state,
  pending,
  stale,
  onAcceptAll,
  onRejectAll,
  onRetry,
}: {
  state: SuggestState;
  pending: number;
  stale: boolean;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onRetry: () => void;
}) {
  const t = useTranslations('Authoring.prosodyEditor');
  const line = (children: ReactNode, tone = 'text-(--ssz-text-secondary)') => (
    <p
      role="status"
      className={`m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm ${tone}`}
    >
      {children}
    </p>
  );
  const link = (label: string, onClick: () => void) => (
    <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onClick}>
      {label}
    </Button>
  );

  switch (state.status) {
    case 'idle':
      return null;
    case 'loading':
      return line(t('suggestLoading'));
    case 'refused':
      return line(t(REFUSAL_KEYS[state.reason]), 'text-(--ssz-color-warning-700)');
    case 'failed':
      return line(
        <>
          {t('suggestFailed')}
          {link(t('suggestRetry'), onRetry)}
        </>,
        'text-(--ssz-color-error-700)',
      );
    case 'ready':
      if (stale) return line(t('suggestStale'));
      if (pending === 0) return state.closed.length === 0 ? line(t('suggestSame')) : null;
      return line(
        <>
          <span className="text-(--ssz-color-info-700)">
            ✦ {t('suggestReady', { count: pending })}
          </span>
          {link(t('suggestAcceptAll'), onAcceptAll)}
          {link(t('suggestRejectAll'), onRejectAll)}
        </>,
      );
  }
}

function Orphans({
  orphans,
  placing,
  onPlace,
  onDrop,
}: {
  orphans: readonly ProsodyOrphan[];
  placing: number | null;
  onPlace: (index: number) => void;
  onDrop: (index: number) => void;
}) {
  const t = useTranslations('Authoring.prosodyEditor');
  const describe = (orphan: ProsodyOrphan) => {
    const word = orphan.mark.w;
    switch (orphan.kind) {
      case 'stress':
        return t('orphanStress', { word });
      case 'unstressed':
        return t('orphanUnstressed', { word });
      case 'accent':
        return t('orphanAccent', { word });
      case 'link':
        return t('orphanLink', { word: word.split(/\s+/).join(' ‿ ') });
      case 'boundary': {
        const { pitch, pause } = orphan.mark;
        const sign =
          (pitch === 'fall' ? '↘' : pitch === 'rise' ? '↗' : pitch === 'level' ? '→' : '') +
          (pause === 'long' ? '‖' : pause === 'short' ? '|' : '');
        return t('orphanBoundary', { word, sign });
      }
    }
  };

  return (
    <section
      aria-label={t('orphansLabel')}
      className="flex flex-col gap-1.5 rounded-(--ssz-radius-sm) border border-(--ssz-color-warning-600) bg-[color-mix(in_srgb,var(--ssz-color-warning-600)_6%,transparent)] p-3"
    >
      <p className="m-0 text-sm">{t('orphansTitle', { count: orphans.length })}</p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {orphans.map((orphan, k) => (
          <li
            key={`${orphan.kind}-${orphan.mark.i}-${k}`}
            className="flex flex-wrap items-baseline gap-x-3 text-sm"
          >
            <span style={READING}>{describe(orphan)}</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0"
              aria-pressed={placing === k}
              onClick={() => onPlace(k)}
            >
              {t('orphanPlace')}
            </Button>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-(--ssz-color-error-700)"
              onClick={() => onDrop(k)}
            >
              {t('orphanDrop')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
