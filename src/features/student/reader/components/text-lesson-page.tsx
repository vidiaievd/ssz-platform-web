'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignJustify,
  AlignLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  Highlighter,
  Layers,
  StretchHorizontal,
  Target,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  AnnotationCardPanel,
  AudioPlayer,
  ErrorState,
  GlossIntensityProvider,
  GlossaryTargetProvider,
  GrammarLinkProvider,
  LessonProse,
  LookupTelemetryProvider,
  LearningSkeleton,
  buildGlossaryIndex,
  resolveGlossIntensity,
  useSrsCardStates,
  usesAuthoredVocabulary,
  useSelectedAnnotationStore,
  useSelectedWordStore,
  WordCardPanel,
  type GlossaryIndex,
  type GlossVisibility,
  type UnitContentsItemStatus,
} from '@/features/learning';
import {
  useLesson,
  useBestLessonVariant,
  useExercisesForRunner,
  useLessonParagraphs,
  useLessonGlossaryMarks,
  useLessonListeningStages,
  useLessonTextSpans,
  useUnitVocabularyItems,
} from '@/features/content';
import type { LessonTextSpan } from '@/features/content/types';
import { useMyStudentProfile } from '@/features/profile';
import { useMediaAsset } from '@/features/media';
import { findAudioNarration, findHeroImage, isMediaOnlyParagraph } from '@/lib/content/lesson-media-tokens';
import { cn } from '@/lib/utils';

import { useGrammarRuleLinks } from '../hooks/use-grammar-rule-links';
import { useScrollRestoration } from '../hooks/use-scroll-restoration';
import { useReadingModeStore, type ReadingMode, type TextWidth } from '../stores/reading-mode-store';
import { ReaderRailSlot, useReaderRailVisible } from './reader-rail';
import { TextComprehensionCheck } from './text-comprehension-check';
import {
  parseComprehensionExercise,
  parseGapFillExercise,
  type ListeningComprehensionItem,
  type ListeningGapFillItem,
} from '../lib/parse-listening-exercise';

export interface TextLessonPageProps {
  lessonId: string;
  /** The unit module's vocabulary list — glossary marks resolve against its items. Undefined if the unit has none. */
  vocabularyListId?: string;
  unitPosition: number;
  courseTitle: string;
  cefrLevel: string;
  /** Reader-shell's `activeContentItem.status`. Drives the second-pass re-read offer below. */
  status?: UnitContentsItemStatus;
  /**
   * The course and unit this text is being read in. Only used to link an
   * annotated grammar rule to its own page; absent outside the reader route,
   * where the annotation card simply carries no link.
   */
  courseId?: string;
  unitId?: string;
}

function formatMinutesSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function countWords(paragraphs: { target: string }[]): number {
  return paragraphs.reduce(
    (sum, p) => sum + p.target.trim().split(/\s+/).filter(Boolean).length,
    0,
  );
}

const MODES: ReadingMode[] = ['immersive', 'bilingual', 'focus'];
const MODE_ICON = { immersive: BookOpen, bilingual: Layers, focus: Target };

/**
 * Shared shell for the three reading toggles.
 *
 * `compact` drops the text labels, which is what lets the group survive the
 * 288px of usable rail width. The label still reaches assistive tech and the
 * pointer through `aria-label` and `title`, so only the at-a-glance reading of
 * an unfamiliar control is lost — a first-run cost, paid once, in exchange for
 * controls that no longer scroll away with the text.
 */
function ToggleGroup<T extends string>({
  label,
  options,
  value,
  icons,
  labelOf,
  onChange,
  compact,
}: {
  label: string;
  options: T[];
  value: T;
  icons: Record<string, typeof BookOpen>;
  labelOf: (option: T) => string;
  onChange: (option: T) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex gap-0.5 rounded-xl border border-(--ssz-border-default) bg-(--ssz-bg-subtle) p-0.75"
    >
      {options.map((option) => {
        const active = option === value;
        const Icon = icons[option];
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={labelOf(option)}
            title={labelOf(option)}
            onClick={() => onChange(option)}
            className={cn(
              'flex items-center rounded-lg py-1.5 text-xs font-semibold transition-all',
              compact ? 'px-2.5' : 'gap-1.5 px-3.5',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
              active
                ? 'bg-surface text-(--ssz-color-primary-700) shadow-(--ssz-shadow-sm)'
                : 'text-(--ssz-text-secondary)',
            )}
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            {Icon && (
              <Icon
                size={13}
                aria-hidden="true"
                className={active && !compact ? 'text-(--ssz-color-primary-600)' : ''}
              />
            )}
            {!compact && labelOf(option)}
          </button>
        );
      })}
    </div>
  );
}

function ModeToggle({
  mode,
  modes,
  onChange,
  compact,
}: {
  mode: ReadingMode;
  modes: ReadingMode[];
  onChange: (m: ReadingMode) => void;
  compact?: boolean;
}) {
  const t = useTranslations('Learning.reader.text.mode');
  return (
    <ToggleGroup
      label={t('label')}
      options={modes}
      value={mode}
      icons={MODE_ICON}
      labelOf={(m) => t(m)}
      onChange={onChange}
      compact={compact}
    />
  );
}

const GLOSS_VISIBILITIES: GlossVisibility[] = ['all', 'unknown', 'off'];
const GLOSS_ICON = { all: Highlighter, unknown: Filter, off: EyeOff };

function GlossToggle({
  visibility,
  onChange,
  compact,
}: {
  visibility: GlossVisibility;
  onChange: (v: GlossVisibility) => void;
  compact?: boolean;
}) {
  const t = useTranslations('Learning.reader.text.gloss');
  return (
    <ToggleGroup
      label={t('label')}
      options={GLOSS_VISIBILITIES}
      value={visibility}
      icons={GLOSS_ICON}
      labelOf={(v) => t(v)}
      onChange={onChange}
      compact={compact}
    />
  );
}

const TEXT_WIDTHS: TextWidth[] = ['narrow', 'medium', 'wide'];
const WIDTH_ICON = { narrow: AlignJustify, medium: AlignLeft, wide: StretchHorizontal };

/**
 * Reading measure as a reader preference rather than a fixed rule. The narrow
 * end is the typographic optimum; the wide end is there because a fixed 680px
 * column on a 1900px screen reads as wasted space whatever the rule says.
 */
function WidthToggle({
  width,
  onChange,
}: {
  width: TextWidth;
  onChange: (w: TextWidth) => void;
}) {
  const t = useTranslations('Learning.reader.text.width');
  return (
    <ToggleGroup
      label={t('label')}
      options={TEXT_WIDTHS}
      value={width}
      icons={WIDTH_ICON}
      labelOf={(w) => t(w)}
      onChange={onChange}
      compact
    />
  );
}

interface ModeProps {
  /**
   * Renderable paragraphs, each keeping the index it has in the variant's own
   * paragraph split. Media-only paragraphs are filtered out before this point,
   * so the position in this array is *not* that index — and spans are anchored
   * to the index (spec 16 §2.4).
   */
  paragraphs: { index: number; target: string; translation: string | null }[];
  glossary: GlossaryIndex;
  targetLang: string;
  translationLang: string;
  cefrLevel: string;
  /** False when the variant has no paragraph translations — translation-dependent controls stay hidden. */
  hasTranslations: boolean;
  /** Author spans of this variant, grouped by the paragraph index they anchor to. */
  spansByParagraph: Map<number, LessonTextSpan[]>;
  /** Spec 16 §5.3 — the variant has vocab spans, so the tokenizer is off throughout. */
  authoredVocabulary: boolean;
  /** Gloss visibility is `off`: grammar and chunk backdrops are withheld. */
  spansHidden: boolean;
}

function ImmersiveMode({
  paragraphs,
  glossary,
  targetLang,
  translationLang,
  cefrLevel,
  hasTranslations,
  spansByParagraph,
  authoredVocabulary,
  spansHidden,
}: ModeProps) {
  const t = useTranslations('Learning.reader.text.page');
  const [showTranslation, setShowTranslation] = useState(false);

  return (
    <div>
      <div className="flex flex-col gap-6">
        {paragraphs.map((p) => (
          <div key={p.index}>
            <LessonProse
              text={p.target}
              glossary={glossary}
              lang={targetLang}
              cefrLevel={cefrLevel}
              spans={spansByParagraph.get(p.index)}
              authoredVocabulary={authoredVocabulary}
              spansHidden={spansHidden}
              explanationLanguage={translationLang}
              className="text-[19px] leading-[1.9]"
            />
            {showTranslation && p.translation && (
              <p
                lang={translationLang}
                className="font-reading mt-2.5 border-l-2 border-(--ssz-color-primary-300) pl-3.5 text-sm leading-relaxed text-(--ssz-text-muted) italic"
              >
                {p.translation}
              </p>
            )}
          </div>
        ))}
      </div>
      {hasTranslations && (
        <button
          type="button"
          onClick={() => setShowTranslation((v) => !v)}
          aria-pressed={showTranslation}
          className={cn(
            'mt-5.5 inline-flex items-center gap-1.5 rounded-lg border-[1.5px] px-3.5 py-1.5',
            'text-xs font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
            showTranslation
              ? 'border-(--ssz-color-primary-500) text-(--ssz-color-primary-600)'
              : 'border-(--ssz-border-default) text-(--ssz-text-secondary)',
          )}
          style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
        >
          {showTranslation ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
          {showTranslation ? t('hideTranslation') : t('showTranslation')}
        </button>
      )}
    </div>
  );
}

function BilingualMode({
  paragraphs,
  glossary,
  targetLang,
  translationLang,
  cefrLevel,
  spansByParagraph,
  authoredVocabulary,
  spansHidden,
}: ModeProps) {
  const t = useTranslations('Learning.reader.text.page');

  return (
    <div className="flex flex-col">
      <div className="mb-1.5 grid grid-cols-2 gap-x-7 border-b border-(--ssz-border-default) pb-2">
        <span className="text-2xs font-bold tracking-wider text-(--ssz-text-muted) uppercase">
          {t('columnTarget')}
        </span>
        <span className="text-2xs font-bold tracking-wider text-(--ssz-text-muted) uppercase">
          {t('columnTranslation')}
        </span>
      </div>
      {paragraphs.map((p, i) => (
        <div
          key={p.index}
          className={cn(
            'grid grid-cols-2 gap-x-7 py-3.5',
            i < paragraphs.length - 1 && 'border-b border-(--ssz-border-default)',
          )}
        >
          <LessonProse
            text={p.target}
            glossary={glossary}
            lang={targetLang}
            cefrLevel={cefrLevel}
            spans={spansByParagraph.get(p.index)}
            authoredVocabulary={authoredVocabulary}
            spansHidden={spansHidden}
            explanationLanguage={translationLang}
            className="text-[17px] leading-[1.8]"
          />
          <p
            lang={translationLang}
            className="font-reading m-0 text-[16px] leading-[1.8] text-(--ssz-text-secondary)"
          >
            {p.translation}
          </p>
        </div>
      ))}
    </div>
  );
}

function FocusMode({
  paragraphs,
  glossary,
  targetLang,
  translationLang,
  cefrLevel,
  spansByParagraph,
  authoredVocabulary,
  spansHidden,
}: ModeProps) {
  const t = useTranslations('Learning.reader.text.page');
  const [active, setActive] = useState(0);
  const clampedActive = Math.min(active, Math.max(paragraphs.length - 1, 0));

  return (
    <div>
      <div className="flex flex-col gap-5.5">
        {paragraphs.map((p, i) => {
          const on = i === clampedActive;
          return (
            <div
              key={p.index}
              role="button"
              tabIndex={0}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActive(i);
                }
              }}
              className={cn(
                'cursor-pointer rounded-[14px] border-[1.5px] px-4.5 py-4 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
                on
                  ? 'border-(--ssz-color-primary-300) bg-surface shadow-(--ssz-shadow-sm) opacity-100'
                  : 'border-transparent opacity-40',
              )}
            >
              <LessonProse
                text={p.target}
                glossary={glossary}
                lang={targetLang}
                cefrLevel={cefrLevel}
                spans={spansByParagraph.get(p.index)}
                authoredVocabulary={authoredVocabulary}
                spansHidden={spansHidden}
                explanationLanguage={translationLang}
                className={on ? 'text-[20px] leading-[1.9]' : 'text-[18px] leading-[1.9]'}
              />
              {on && p.translation && (
                <p
                  lang={translationLang}
                  className="font-reading mt-2.75 border-l-2 border-(--ssz-color-primary-300) pl-3.5 text-sm leading-relaxed text-(--ssz-text-muted) italic"
                >
                  {p.translation}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => setActive((a) => Math.max(0, a - 1))}
          disabled={clampedActive === 0}
          aria-label={t('previousParagraph')}
          className="flex items-center rounded-lg border-[1.5px] border-(--ssz-border-default) p-2 text-(--ssz-text-secondary) disabled:opacity-40"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <span className="text-xs font-semibold text-(--ssz-text-muted)">
          {t('paragraphOf', { current: clampedActive + 1, total: paragraphs.length })}
        </span>
        <button
          type="button"
          onClick={() => setActive((a) => Math.min(paragraphs.length - 1, a + 1))}
          disabled={clampedActive === paragraphs.length - 1}
          aria-label={t('nextParagraph')}
          className="flex items-center rounded-lg border-[1.5px] border-(--ssz-border-default) p-2 text-(--ssz-text-secondary) disabled:opacity-40"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function TextLessonPage({
  lessonId,
  vocabularyListId,
  unitPosition,
  courseTitle,
  cefrLevel,
  status,
  courseId,
  unitId,
}: TextLessonPageProps) {
  const t = useTranslations('Learning.reader.text.page');
  const tContent = useTranslations('Content');
  const tMode = useTranslations('Learning.reader.text.mode');
  const tGloss = useTranslations('Learning.reader.text.gloss');
  const tWidth = useTranslations('Learning.reader.text.width');
  const { mode, setMode, glossVisibility, setGlossVisibility, textWidth, setTextWidth } =
    useReadingModeStore();
  const railVisible = useReaderRailVisible();

  // Second pass (spec-less "melochi" E3.3): offered once the reader has already
  // completed this text. Timing starts only once they opt in, not on arrival —
  // arriving here is often just re-reading via the sidebar, not a timed retry.
  const [secondPassActive, setSecondPassActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!secondPassActive) return;
    const startedAt = Date.now();
    const interval = setInterval(() => setElapsedSeconds(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [secondPassActive]);

  // The selected word belongs to the text it was read in: its context sentence
  // and its highlighted form are quoted from this variant. Carrying it across a
  // navigation would leave the rail describing a word from the previous lesson.
  const clearSelectedWord = useSelectedWordStore((s) => s.clear);
  useEffect(() => clearSelectedWord, [lessonId, clearSelectedWord]);
  // Same for the annotation card, which quotes the annotated words themselves.
  const selectedAnnotation = useSelectedAnnotationStore((s) => s.selected);
  const clearSelectedAnnotation = useSelectedAnnotationStore((s) => s.clear);
  useEffect(() => clearSelectedAnnotation, [lessonId, clearSelectedAnnotation]);

  const lesson = useLesson(lessonId);
  const profile = useMyStudentProfile();
  const nativeLanguage = profile.data?.nativeLanguage ?? undefined;
  const profileReady = !profile.isLoading && !!nativeLanguage;

  const variant = useBestLessonVariant(lessonId, nativeLanguage ?? '', cefrLevel, profileReady);
  const paragraphsQuery = useLessonParagraphs(lessonId, variant.data?.id);
  const marksQuery = useLessonGlossaryMarks(lessonId, variant.data?.id);
  // Broken spans are withheld server-side, so everything here is renderable.
  const spansQuery = useLessonTextSpans(lessonId, variant.data?.id);
  const vocabItems = useUnitVocabularyItems(vocabularyListId ?? '', !!vocabularyListId);
  // The post-reading check. Deliberately outside the page's loading and error
  // gates below: a text must render even when its check does not (spec 17 §5.4).
  const stagesQuery = useLessonListeningStages(lessonId, variant.data?.id);

  const heroImage = useMemo(() => findHeroImage(variant.data?.bodyMarkdown ?? ''), [variant.data?.bodyMarkdown]);
  const narration = useMemo(
    () => findAudioNarration(variant.data?.bodyMarkdown ?? ''),
    [variant.data?.bodyMarkdown],
  );
  const heroAsset = useMediaAsset(heroImage?.mediaId);
  const narrationAsset = useMediaAsset(narration?.mediaId);

  const glossary = useMemo(() => {
    const markedIds = new Set((marksQuery.data ?? []).map((m) => m.vocabularyItemId));
    return buildGlossaryIndex((vocabItems.data ?? []).filter((item) => markedIds.has(item.id)));
  }, [marksQuery.data, vocabItems.data]);

  // The glossary index is keyed by surface form, so one item appears under
  // several keys; the card-states request needs each word exactly once.
  const glossedItemIds = useMemo(
    () => [...new Set([...glossary.values()].map((entry) => entry.item.id))],
    [glossary],
  );
  // Fetched regardless of the visibility setting: turning the underlines off
  // hides them, but a word the reader already knows must stay unmarked the
  // moment they turn glossing back on.
  const cardStates = useSrsCardStates(glossedItemIds);

  const statesById = useMemo(
    () => new Map((cardStates.data?.states ?? []).map((s) => [s.contentId, s])),
    [cardStates.data],
  );

  // While the states are in flight `statesById` is empty, which resolves to
  // 'normal' — the reader sees the usual glossing instead of a blank text.
  const resolveIntensity = useMemo(
    () => (vocabularyItemId: string) => {
      const state = statesById.get(vocabularyItemId);
      return resolveGlossIntensity(glossVisibility, state?.state, state?.stability);
    },
    [statesById, glossVisibility],
  );

  const gapFillStages = useMemo(
    () =>
      (stagesQuery.data ?? [])
        .filter((s) => s.stageType === 'gap_fill')
        .sort((a, b) => a.position - b.position),
    [stagesQuery.data],
  );
  const compStages = useMemo(
    () =>
      (stagesQuery.data ?? [])
        .filter((s) => s.stageType === 'comprehension')
        .sort((a, b) => a.position - b.position),
    [stagesQuery.data],
  );
  const gapFillExercises = useExercisesForRunner(gapFillStages.map((s) => s.exerciseId));
  const compExercises = useExercisesForRunner(compStages.map((s) => s.exerciseId));

  // An exercise whose content does not fit the template shape is dropped rather
  // than rendered half-parsed, exactly as the listening flow drops it.
  const gapFillItems: ListeningGapFillItem[] = useMemo(
    () =>
      gapFillStages
        .map((s, i) => {
          const display = gapFillExercises[i]?.data;
          return display ? parseGapFillExercise(s, display) : null;
        })
        .filter((item): item is ListeningGapFillItem => item !== null),
    [gapFillStages, gapFillExercises],
  );
  const compItems: ListeningComprehensionItem[] = useMemo(
    () =>
      compStages
        .map((s, i) => {
          const display = compExercises[i]?.data;
          return display ? parseComprehensionExercise(s, display) : null;
        })
        .filter((item): item is ListeningComprehensionItem => item !== null),
    [compStages, compExercises],
  );

  /**
   * Renderable paragraphs, each carrying the index it holds in the variant's
   * own paragraph split.
   *
   * Every seeded Norwegian text opens with a hero-image token, and audio
   * narration adds another, so the media-only filter below shifts the position
   * of everything after it. A span is anchored to the *unfiltered* index
   * (spec 16 §2.4), and losing it here fails silently: the annotation would
   * render on a neighbouring paragraph and still validate against the right
   * one server-side, so nothing would ever report it.
   */
  const proseParagraphs = useMemo(
    () =>
      (paragraphsQuery.data ?? [])
        .map((paragraph, index) => ({ ...paragraph, index }))
        .filter((paragraph) => !isMediaOnlyParagraph(paragraph.target)),
    [paragraphsQuery.data],
  );

  const wordCount = useMemo(() => countWords(proseParagraphs), [proseParagraphs]);
  const wpm = elapsedSeconds > 0 ? Math.round(wordCount / (elapsedSeconds / 60)) : 0;

  const spansByParagraph = useMemo(() => {
    const byIndex = new Map<number, LessonTextSpan[]>();
    for (const span of spansQuery.data ?? []) {
      const list = byIndex.get(span.paragraphIndex);
      if (list) list.push(span);
      else byIndex.set(span.paragraphIndex, [span]);
    }
    return byIndex;
  }, [spansQuery.data]);

  // Sorted, so the array identity survives a refetch that returns the same
  // rules in another order — it is the resolver's dependency.
  const annotatedRuleIds = useMemo(
    () =>
      [
        ...new Set(
          (spansQuery.data ?? [])
            .filter((span) => span.kind === 'grammar' && span.refId)
            .map((span) => span.refId as string),
        ),
      ].sort(),
    [spansQuery.data],
  );
  const grammarLinks = useGrammarRuleLinks(courseId ?? '', unitId ?? '', annotatedRuleIds);

  /**
   * Anything the visibility toggle can act on. A text annotated only for
   * grammar or chunks has no vocabulary glossary, and gating the toggle on that
   * alone would leave the reader no way to turn those backdrops off.
   */
  const hasGlossing = glossary.size > 0 || (spansQuery.data?.length ?? 0) > 0;

  // Decided once for the whole variant, never per paragraph (spec 16 §5.3).
  const authoredVocabulary = useMemo(
    () => usesAuthoredVocabulary(spansQuery.data ?? []),
    [spansQuery.data],
  );

  /**
   * Paragraph translations are optional content — most variants have none. Modes and
   * controls that only make sense with them stay hidden until the content exists,
   * so they light up on their own once translations are authored.
   */
  const hasTranslations = useMemo(
    () => proseParagraphs.some((p) => !!p.translation?.trim()),
    [proseParagraphs],
  );
  const availableModes = useMemo(
    () => MODES.filter((m) => m !== 'bilingual' || hasTranslations),
    [hasTranslations],
  );
  // Scaffolding fades with level: A1–A2 start bilingual, B1+ start immersive.
  // A student's own choice (once made) always wins over the level default.
  const levelDefaultMode: ReadingMode = cefrLevel === 'A1' || cefrLevel === 'A2' ? 'bilingual' : 'immersive';
  const desiredMode = mode ?? levelDefaultMode;
  // A persisted/derived 'bilingual' preference must not strand the reader on an empty screen.
  const effectiveMode = availableModes.includes(desiredMode) ? desiredMode : 'immersive';

  /**
   * Spans are part of this gate, not a decoration layered on afterwards: they
   * *replace* the tokenizer for the whole variant (spec 16 §5.3). Letting the
   * text paint first would show every tokenizer match and then rewrite the
   * highlighting once the spans land — the flash of glossing A4 removed.
   */
  const glossaryLoading =
    marksQuery.isLoading || spansQuery.isLoading || (!!vocabularyListId && vocabItems.isLoading);
  const isLoading =
    lesson.isLoading ||
    profile.isLoading ||
    (profileReady && variant.isLoading) ||
    paragraphsQuery.isLoading ||
    glossaryLoading;
  const isError = lesson.isError || profile.isError || (profileReady && variant.isError);

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  useScrollRestoration(
    scrollAnchorRef,
    variant.data ? `${lessonId}:${variant.data.id}` : undefined,
    !isLoading,
  );

  if (isLoading) {
    return <LearningSkeleton variant="card" rows={4} />;
  }

  if (isError || !lesson.data) {
    return (
      <ErrorState
        onRetry={() => {
          lesson.refetch();
          profile.refetch();
          if (profileReady) variant.refetch();
        }}
      />
    );
  }

  if (!profileReady || !variant.data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-2xl border border-(--ssz-border-default) bg-surface px-6 py-16 text-center">
        <p className="text-lg font-medium text-(--ssz-text-primary)">{t('emptyTitle')}</p>
        <p className="text-sm text-(--ssz-text-muted)">{t('emptyBody')}</p>
      </div>
    );
  }

  const ModeComponent =
    effectiveMode === 'bilingual' ? BilingualMode : effectiveMode === 'focus' ? FocusMode : ImmersiveMode;

  return (
    // Wraps the rail slot as well as the prose: the slot is a portal, and React
    // context follows the tree it is written in, not the DOM it lands in.
    <GrammarLinkProvider links={grammarLinks}>
    <div ref={scrollAnchorRef}>
      {heroImage && (
        /*
          `object-contain` on a fixed 16:9 frame, not `object-cover` on a fixed
          height: course art is drawn illustration, and cropping it to a ~3:1
          band cut the figures' heads and feet off. Letterboxing against the
          subtle background costs a little space and mangles nothing.
        */
        <div className="mb-6.5 aspect-video overflow-hidden rounded-[20px] bg-subtle">
          {heroAsset.data?.url && (
            // eslint-disable-next-line @next/next/no-img-element -- author-uploaded lesson asset
            <img src={heroAsset.data.url} alt={heroImage.alt} className="h-full w-full object-contain" />
          )}
        </div>
      )}

      <div className="mb-4.5">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <div className="text-[11px] font-bold tracking-wider text-(--ssz-color-primary-600) uppercase">
            {t('eyebrow', { unit: unitPosition, course: courseTitle, type: tContent('materialType.text') })}
          </div>
          {!!variant.data.estimatedReadingMinutes && (
            <span className="text-xs font-medium text-(--ssz-text-muted)">
              {t('estimatedReadingMinutes', { minutes: variant.data.estimatedReadingMinutes })}
            </span>
          )}
        </div>
        <h1 className="font-reading mb-1.5 text-[29px] leading-[1.15] font-semibold tracking-tight text-(--ssz-text-primary)">
          {variant.data.displayTitle || lesson.data.title}
        </h1>
        {variant.data.displayDescription && (
          <p className="text-sm text-(--ssz-text-muted) italic">{variant.data.displayDescription}</p>
        )}
      </div>

      {status === 'completed' && !secondPassActive && glossVisibility !== 'off' && (
        <div className="mb-5.5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-[1.5px] border-(--ssz-border-default) bg-surface px-4.5 py-3.5">
          <div>
            <p className="text-sm font-semibold text-(--ssz-text-primary)">{t('secondPassOfferTitle')}</p>
            <p className="text-xs text-(--ssz-text-muted)">{t('secondPassOfferBody')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setGlossVisibility('off');
              setElapsedSeconds(0);
              setSecondPassActive(true);
            }}
            className="rounded-lg border-[1.5px] border-(--ssz-color-primary-500) px-3.5 py-1.5 text-xs font-semibold text-(--ssz-color-primary-600)"
          >
            {t('secondPassStart')}
          </button>
        </div>
      )}

      {secondPassActive && (
        <div className="mb-5.5 text-xs font-semibold text-(--ssz-text-muted)">
          {t('secondPassStats', { time: formatMinutesSeconds(elapsedSeconds), wpm })}
        </div>
      )}

      {/*
        Inline only while the rail is off screen. In the rail these same
        controls stay put as the prose scrolls, which is the point of moving
        them: on a six-minute text the old row was several screens above the
        paragraph the reader wanted to change the setting for.
      */}
      {!railVisible && (
      <div className="mb-5.5 flex flex-wrap items-center gap-3.5">
        <ModeToggle mode={effectiveMode} modes={availableModes} onChange={setMode} />
        {hasGlossing && <GlossToggle visibility={glossVisibility} onChange={setGlossVisibility} />}
        <WidthToggle width={textWidth} onChange={setTextWidth} />
        {glossary.size > 0 && glossVisibility !== 'off' && (
          <span className="flex items-center gap-1.5 text-xs text-(--ssz-text-muted)">
            <span
              className="inline-block w-6.5 align-middle border-b-[1.5px] border-dotted border-(--ssz-color-primary-500)"
              aria-hidden="true"
            />
            {t('tapToLookUp')}
          </span>
        )}
      </div>
      )}

      {/*
        The rail is its own scroll container, so what goes there stays on screen
        while the prose scrolls — no sticky positioning needed. The slot is
        rendered only when there is something to put in it: mounting it with an
        empty body would claim the whole 320px column for padding.

        Below the rail's breakpoint the slot renders nothing and these fall back
        inline, which is why the two branches are exclusive rather than both mounted.
      */}
      {/*
        One slot, not several: with separate portals the rail's order would be
        the order the slots happened to mount in, which changes the moment a
        section becomes conditional.

        The word card comes last because it is the only block whose height
        varies — empty hint versus a full paradigm. Anything below it would be
        shoved down and back on every lookup, so nothing is below it.
      */}
      <ReaderRailSlot>
        <div>
        <div className="flex flex-col gap-5 p-4">
            {narration && (
              <section>
                <h2 className="mb-2 text-[10.5px] font-bold tracking-wide text-(--ssz-text-muted) uppercase">
                  {t('railAudio')}
                </h2>
                <AudioPlayer
                  src={narrationAsset.data?.url}
                  label={variant.data.displayTitle || lesson.data.title}
                  interactive={!!narrationAsset.data?.url}
                />
              </section>
            )}
            <section>
              <h2 className="mb-2 text-[10.5px] font-bold tracking-wide text-(--ssz-text-muted) uppercase">
                {t('railReading')}
              </h2>
              {/*
                Label beside the group rather than above it: three stacked
                heading+control pairs would be twice as tall for no extra
                clarity, and the rail's height is what keeps these controls
                reachable without a scroll.
              */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-(--ssz-text-secondary)">{tMode('label')}</span>
                  <ModeToggle mode={effectiveMode} modes={availableModes} onChange={setMode} compact />
                </div>
                {hasGlossing && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-(--ssz-text-secondary)">{tGloss('label')}</span>
                    <GlossToggle visibility={glossVisibility} onChange={setGlossVisibility} compact />
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-(--ssz-text-secondary)">{tWidth('label')}</span>
                  <WidthToggle width={textWidth} onChange={setTextWidth} />
                </div>
              </div>
              {glossary.size > 0 && glossVisibility !== 'off' && (
                <p className="mt-2.5 flex items-center gap-1.5 text-xs text-(--ssz-text-muted)">
                  <span
                    className="inline-block w-6.5 border-b-[1.5px] border-dotted border-(--ssz-color-primary-500) align-middle"
                    aria-hidden="true"
                  />
                  {t('tapToLookUp')}
                </p>
              )}
            </section>
          </div>
          {/*
            One card, not two stacked: the rail answers "what am I looking at
            right now", and the reader's last click is what decides. The word
            card is the resting state, so the column keeps its height whether or
            not this text carries annotations.
          */}
          {selectedAnnotation ? (
            <AnnotationCardPanel
              explanationLanguage={variant.data.explanationLanguage}
              cefrLevel={cefrLevel}
            />
          ) : (
            <WordCardPanel targetLanguage={lesson.data.targetLanguage} cefrLevel={cefrLevel} />
          )}
        </div>
      </ReaderRailSlot>

      {narration && !railVisible && (
        <div className="mb-6.5">
          <AudioPlayer
            src={narrationAsset.data?.url}
            label={variant.data.displayTitle || lesson.data.title}
            interactive={!!narrationAsset.data?.url}
          />
        </div>
      )}

      {proseParagraphs.length === 0 ? (
        <p className="text-sm text-(--ssz-text-muted) italic">{t('noParagraphs')}</p>
      ) : (
        <GlossIntensityProvider resolve={resolveIntensity}>
          <GlossaryTargetProvider target={railVisible ? 'panel' : 'popover'}>
          <LookupTelemetryProvider lessonId={lessonId} lessonVariantId={variant.data.id}>
            <ModeComponent
              paragraphs={proseParagraphs}
              glossary={glossary}
              targetLang={lesson.data.targetLanguage}
              translationLang={variant.data.explanationLanguage}
              cefrLevel={cefrLevel}
              hasTranslations={hasTranslations}
              spansByParagraph={spansByParagraph}
              authoredVocabulary={authoredVocabulary}
              spansHidden={glossVisibility === 'off'}
            />
          </LookupTelemetryProvider>
          </GlossaryTargetProvider>
        </GlossIntensityProvider>
      )}

      <TextComprehensionCheck gapFillItems={gapFillItems} compItems={compItems} />
    </div>
    </GrammarLinkProvider>
  );
}
