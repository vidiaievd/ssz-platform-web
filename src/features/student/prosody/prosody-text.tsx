'use client';

import { type CSSProperties, type ReactNode } from 'react';

import { tokenize } from '@/lib/shared-kernel/text/words';
import {
  respell,
  segsCoverWord,
  type GroupBoundary,
  type PhraseAccent,
  type ProsodyLayer,
  type SoundSeg,
  type WordSounds,
  type WordStress,
} from '@/lib/shared-kernel/prosody';

/**
 * Which one thing about pronunciation is drawn on the text (plan 86, §4i.2, Q-i7). One at a time:
 * each lens answers its own question, and their sum is not readable.
 *  · `stress`  — the stressed vowel, bold and coloured, a × over it, a long one with a band under it;
 *  · `sounds`  — silent letters pale, vowels as strong as they are said, letters of one sound bracketed;
 *  · `melody`  — the toneme sign over the stressed vowel, the accent word bold, the end of a group;
 *  · `respell` — the text as it sounds, in the teacher's letters.
 */
export type ProsodyLens = 'stress' | 'sounds' | 'melody' | 'respell';

export const PROSODY_LENSES: readonly ProsodyLens[] = ['stress', 'sounds', 'respell', 'melody'];

export interface ProsodyView {
  /** `null` — nothing of the pronunciation is drawn («Meaning»). */
  lens: ProsodyLens | null;
}

export interface ProsodyTextProps {
  /** The passage exactly as written; the layer's anchors count tokens of this string. */
  text: string;
  layer: ProsodyLayer;
  /** The lexicon's letters-over-sounds of the words, anchored like the layer. */
  sounds?: readonly WordSounds[];
  view: ProsodyView;
  lang?: string;
  className?: string;
  style?: CSSProperties;
}

/** Word melody and stressed vowels. */
const ACCENT = 'var(--ssz-color-primary-600)';
/** Phrase ends and pauses. */
const PITCH = 'var(--ssz-color-warning-600)';
const VOWEL_BAND = `color-mix(in srgb, ${ACCENT} 35%, transparent)`;
/** A mark the authoring agent set and nobody has touched — shown only to the author. */
const AI_MARK = 'var(--ssz-color-info-600)';

/** Line height that leaves room for the signs over the words. */
export const MARKS_LEADING = 2.4;

/** What the layer and the lexicon say about one word, anchors already checked against the text. */
export interface TokenMarks {
  /** The word as the layer was matched to it — a renderer that re-tokenizes checks it still agrees. */
  word: string;
  stress?: WordStress;
  accent?: PhraseAccent;
  boundary?: GroupBoundary;
  linked?: boolean;
  /** Present only when its segments lie over exactly the letters of the word. */
  sounds?: SoundSeg[];
}

/**
 * The marks per word, keyed by the character offset where the word starts in `text`.
 * A mark whose anchor no longer matches its word (stale `w`) is dropped, not misplaced.
 */
export function marksByStart(
  text: string,
  layer: ProsodyLayer,
  sounds: readonly WordSounds[] = [],
): Map<number, TokenMarks> {
  const tokens = tokenize(text);
  const out = new Map<number, TokenMarks>();
  const at = (i: number, w: string) => {
    const token = tokens[i];
    if (token === undefined || token.w.toLowerCase() !== w.toLowerCase()) return undefined;
    let marks = out.get(token.s);
    if (marks === undefined) out.set(token.s, (marks = { word: token.w }));
    return marks;
  };
  for (const m of layer.stresses) {
    const marks = at(m.i, m.w);
    if (marks) marks.stress = m;
  }
  for (const m of layer.accents) {
    const marks = at(m.i, m.w);
    if (marks) marks.accent = m;
  }
  for (const m of layer.boundaries) {
    const marks = at(m.i, m.w);
    if (marks) marks.boundary = m;
  }
  for (const m of layer.links) {
    const [first] = m.w.split(/\s+/);
    const marks = first === undefined ? undefined : at(m.i, first);
    if (marks) marks.linked = true;
  }
  for (const m of sounds) {
    const marks = at(m.i, m.w);
    if (marks && segsCoverWord(m.segs, m.w.length)) marks.sounds = m.segs;
  }
  return out;
}

/** Whether this lens draws anything on a word with these marks. */
export function drawnIn(lens: ProsodyLens | null, marks: TokenMarks): boolean {
  switch (lens) {
    case 'stress':
      return marks.stress !== undefined;
    case 'sounds':
    case 'respell':
      return marks.sounds !== undefined;
    case 'melody':
      return (
        marks.stress !== undefined ||
        marks.accent !== undefined ||
        marks.boundary !== undefined ||
        marks.linked === true
      );
    default:
      return false;
  }
}

/** A sign over a letter: out of the line, so the text itself keeps its place and its width. */
function Over({
  children,
  color = ACCENT,
  size = '0.62em',
  dashed = false,
}: {
  children: ReactNode;
  color?: string;
  size?: string;
  dashed?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      data-mark="over"
      style={{
        position: 'absolute',
        left: '50%',
        top: '-0.95em',
        transform: 'translateX(-50%)',
        fontSize: size,
        lineHeight: 1,
        color,
        fontWeight: 700,
        ...(dashed
          ? { outline: '1px dashed currentColor', outlineOffset: '1px', borderRadius: '2px' }
          : {}),
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      {children}
    </span>
  );
}

/** The stressed vowel of a word: coloured, bold, with whatever the lens puts over and under it. */
function StressedVowel({
  letters,
  long,
  over,
  band,
}: {
  letters: string;
  long: boolean | null;
  over?: ReactNode;
  band: boolean;
}) {
  return (
    <span
      data-pv=""
      data-vowel={long === true ? 'long' : 'short'}
      style={{
        position: 'relative',
        color: ACCENT,
        fontWeight: 600,
        boxShadow: band && long === true ? `inset 0 -0.14em 0 ${VOWEL_BAND}` : undefined,
      }}
    >
      {over}
      {letters}
    </span>
  );
}

/** The toneme sign over the stressed vowel (Bonk's notation with the toneme: ╱ 1, ∨ 2, ˈ a single syllable). */
function MelodySign({ stress, accent }: { stress: WordStress; accent: boolean }) {
  const sign = stress.toneme === 1 ? '╱' : stress.toneme === 2 ? '∨' : 'ˈ';
  return (
    <Over size={accent ? '0.85em' : '0.62em'}>
      <span data-sign={stress.toneme === null ? 'dot' : String(stress.toneme)}>{sign}</span>
    </Over>
  );
}

function stressFace(word: string, stress: WordStress, lens: ProsodyLens, accent: boolean): ReactNode {
  const { s, e, long } = stress.vowel;
  if (s < 0 || e > word.length || s >= e) return word;
  const letters = word.slice(s, e);
  return (
    <>
      {word.slice(0, s)}
      <StressedVowel
        letters={letters}
        long={long}
        band={lens === 'stress'}
        over={
          lens === 'stress' ? (
            <Over>
              <span data-sign="cross">×</span>
            </Over>
          ) : (
            <MelodySign stress={stress} accent={accent} />
          )
        }
      />
      {word.slice(e)}
    </>
  );
}

/** How strongly a vowel is said: stressed in full, a secondary stress a little less, the schwa least. */
function vowelOpacity(seg: SoundSeg): number {
  if (seg.stress === 1 || seg.stress === 2 || seg.stress === null) return 1;
  if (seg.stress === 3) return 0.8;
  return seg.sounds[0] === 'AX' ? 0.4 : 0.62;
}

function soundsFace(word: string, segs: readonly SoundSeg[]): ReactNode {
  return segs.map((seg, k) => {
    const letters = word.slice(seg.s, seg.e);
    if (letters === '') return null;
    const stressed = seg.kind === 'vowel' && (seg.stress === 1 || seg.stress === 2);
    const style: CSSProperties = {};
    if (seg.kind === 'silent') style.opacity = 0.22;
    else if (seg.kind === 'vowel') style.opacity = vowelOpacity(seg);
    if (stressed) {
      style.color = ACCENT;
      style.fontWeight = 600;
    }
    if (seg.tie) {
      style.borderTop = `1.5px solid color-mix(in srgb, ${ACCENT} 70%, transparent)`;
      style.borderRadius = '0.2em 0.2em 0 0';
    }
    return (
      <span key={k} data-seg={seg.kind} {...(seg.tie ? { 'data-tie': '' } : {})} style={style}>
        {letters}
      </span>
    );
  });
}

/** The word as it sounds: the segments' letters respelled, a × over the stressed vowel. */
function respellFace(word: string, segs: readonly SoundSeg[]): ReactNode {
  let written = '';
  const pieces = segs.map((_, k) => {
    const upTo = respell(segs.slice(0, k + 1));
    const piece = upTo.slice(written.length);
    written = upTo;
    return piece;
  });
  return (
    <>
      <span aria-hidden="true" data-respell="">
        {segs.map((seg, k) =>
          seg.kind === 'vowel' && (seg.stress === 1 || seg.stress === 2) ? (
            <StressedVowel
              key={k}
              letters={pieces[k]!}
              long={null}
              band={false}
              over={
                <Over>
                  <span data-sign="cross">×</span>
                </Over>
              }
            />
          ) : (
            <span key={k}>{pieces[k]}</span>
          ),
        )}
      </span>
      <span className="sr-only">{word}</span>
    </>
  );
}

/**
 * One word with what the lens draws on it. The stressed vowel is always wrapped, so a sign has
 * somewhere to stand; a phrase accent is bold. `sourced` (the author's editor) underlines an
 * accent the agent set, dashed in its own colour.
 */
export function ProsodyWord({
  word,
  marks,
  view,
  sourced = false,
}: {
  word: string;
  marks: TokenMarks;
  view: ProsodyView;
  sourced?: boolean;
}) {
  const { lens } = view;
  if (lens === null) return <>{word}</>;
  const accent = lens === 'melody' && marks.accent !== undefined;
  const byAgent = sourced && accent && marks.accent?.source === 'ai';
  let face: ReactNode = word;
  if ((lens === 'stress' || lens === 'melody') && marks.stress !== undefined) {
    face = stressFace(word, marks.stress, lens, accent);
  } else if (lens === 'sounds' && marks.sounds !== undefined) {
    face = soundsFace(word, marks.sounds);
  } else if (lens === 'respell' && marks.sounds !== undefined) {
    face = respellFace(word, marks.sounds);
  }
  return (
    <span
      data-word=""
      data-lens={lens}
      {...(accent ? { 'data-focus': '' } : {})}
      {...(byAgent ? { 'data-source': 'ai' } : {})}
      className={
        lens === 'melody' && marks.linked === true
          ? "after:text-(--ssz-color-primary-600) after:content-['‿']"
          : undefined
      }
      style={{
        fontWeight: accent ? 700 : undefined,
        ...(byAgent
          ? {
              textDecorationLine: 'underline',
              textDecorationStyle: 'dashed',
              textDecorationColor: AI_MARK,
              textUnderlineOffset: '0.25em',
            }
          : {}),
      }}
    >
      {face}
    </span>
  );
}

/**
 * The end of an intonation group: where the voice goes, and the pause, over the end of the word.
 * `sourced` (the author's editor) draws one the agent set dashed, in its own colour.
 */
export function ProsodyBoundary({
  boundary,
  sourced = false,
}: {
  boundary: GroupBoundary;
  sourced?: boolean;
}) {
  const byAgent = sourced && boundary.source === 'ai';
  const arrow = boundary.pitch === 'rise' ? '↗' : boundary.pitch === 'fall' ? '↘' : boundary.pitch === 'level' ? '→' : '';
  const pause = boundary.pause === 'long' ? '‖' : boundary.pause === 'short' ? '|' : '';
  return (
    <span
      aria-hidden="true"
      data-mark="boundary"
      {...(boundary.pitch === null ? {} : { 'data-pitch': boundary.pitch })}
      {...(byAgent ? { 'data-source': 'ai' } : {})}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '0.55em',
        userSelect: 'none',
      }}
    >
      <Over color={byAgent ? AI_MARK : PITCH} size="0.7em" dashed={byAgent}>
        {arrow}
        {pause}
      </Over>
    </span>
  );
}

/**
 * A passage with one lens of its pronunciation drawn on it (plan 86, §4i.2).
 *
 * The text is never altered: every character of `text` is rendered once and in order, the signs
 * are `aria-hidden` and out of the line, so copy and screen readers see the plain passage (the
 * respelled lens keeps the written word for them). With no lens this is the plain text.
 */
export function ProsodyText({ text, layer, sounds = [], view, lang, className, style }: ProsodyTextProps) {
  const { lens } = view;
  const marks = marksByStart(text, layer, sounds);

  const parts: ReactNode[] = [];
  let at = 0;
  for (const token of tokenize(text)) {
    if (token.s > at) parts.push(text.slice(at, token.s));
    at = token.e;
    const here = marks.get(token.s);
    if (here === undefined || !drawnIn(lens, here)) {
      parts.push(token.w);
      continue;
    }
    parts.push(<ProsodyWord key={token.i} word={token.w} marks={here} view={view} />);
    if (lens === 'melody' && here.boundary !== undefined) {
      parts.push(<ProsodyBoundary key={`b${token.i}`} boundary={here.boundary} />);
    }
  }
  if (at < text.length) parts.push(text.slice(at));

  return (
    <p
      lang={lang}
      className={className}
      style={{ ...style, ...(lens === null ? {} : { lineHeight: MARKS_LEADING }) }}
    >
      {parts}
    </p>
  );
}
