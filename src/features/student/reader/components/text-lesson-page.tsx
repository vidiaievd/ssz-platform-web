'use client';

import { useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Eye, EyeOff, Filter, Highlighter, Layers, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  AudioPlayer,
  ErrorState,
  GlossIntensityProvider,
  LessonProse,
  LookupTelemetryProvider,
  LearningSkeleton,
  buildGlossaryIndex,
  resolveGlossIntensity,
  useSrsCardStates,
  usesAuthoredVocabulary,
  type GlossaryIndex,
  type GlossVisibility,
} from '@/features/learning';
import {
  useLesson,
  useBestLessonVariant,
  useExercisesWithAnswers,
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

import { useReadingModeStore, type ReadingMode } from '../stores/reading-mode-store';
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
}

const MODES: ReadingMode[] = ['immersive', 'bilingual', 'focus'];
const MODE_ICON = { immersive: BookOpen, bilingual: Layers, focus: Target };

function ModeToggle({
  mode,
  modes,
  onChange,
}: {
  mode: ReadingMode;
  modes: ReadingMode[];
  onChange: (m: ReadingMode) => void;
}) {
  const t = useTranslations('Learning.reader.text.mode');
  return (
    <div
      role="radiogroup"
      aria-label={t('label')}
      className="inline-flex gap-0.5 rounded-xl border border-(--ssz-border-default) bg-(--ssz-bg-subtle) p-0.75"
    >
      {modes.map((m) => {
        const active = m === mode;
        const Icon = MODE_ICON[m];
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(m)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
              active
                ? 'bg-surface text-(--ssz-color-primary-700) shadow-(--ssz-shadow-sm)'
                : 'text-(--ssz-text-secondary)',
            )}
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            <Icon size={13} aria-hidden="true" className={active ? 'text-(--ssz-color-primary-600)' : ''} />
            {t(m)}
          </button>
        );
      })}
    </div>
  );
}

const GLOSS_VISIBILITIES: GlossVisibility[] = ['all', 'unknown', 'off'];
const GLOSS_ICON = { all: Highlighter, unknown: Filter, off: EyeOff };

function GlossToggle({
  visibility,
  onChange,
}: {
  visibility: GlossVisibility;
  onChange: (v: GlossVisibility) => void;
}) {
  const t = useTranslations('Learning.reader.text.gloss');
  return (
    <div
      role="radiogroup"
      aria-label={t('label')}
      className="inline-flex gap-0.5 rounded-xl border border-(--ssz-border-default) bg-(--ssz-bg-subtle) p-0.75"
    >
      {GLOSS_VISIBILITIES.map((v) => {
        const active = v === visibility;
        const Icon = GLOSS_ICON[v];
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ssz-border-focus)',
              active
                ? 'bg-surface text-(--ssz-color-primary-700) shadow-(--ssz-shadow-sm)'
                : 'text-(--ssz-text-secondary)',
            )}
            style={{ transitionDuration: 'var(--ssz-duration-fast)' }}
          >
            <Icon size={13} aria-hidden="true" className={active ? 'text-(--ssz-color-primary-600)' : ''} />
            {t(v)}
          </button>
        );
      })}
    </div>
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
}: TextLessonPageProps) {
  const t = useTranslations('Learning.reader.text.page');
  const tContent = useTranslations('Content');
  const { mode, setMode, glossVisibility, setGlossVisibility } = useReadingModeStore();

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
  // Fetched regardless of the visibility setting: the coverage figure below is
  // worth showing even when the reader has turned the underlines off.
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

  /**
   * Share of this text's marked words the reader no longer needs marked up.
   * Deliberately scoped to marked words: only target vocabulary is annotated, so
   * a percentage of *all* words in the text would be a fabricated metric.
   */
  const coveragePercent = useMemo(() => {
    if (glossedItemIds.length === 0 || statesById.size === 0) return null;
    const settled = glossedItemIds.filter((id) => {
      const state = statesById.get(id);
      const intensity = resolveGlossIntensity('unknown', state?.state, state?.stability);
      return intensity === 'none' || intensity === 'muted';
    });
    return Math.round((settled.length / glossedItemIds.length) * 100);
  }, [glossedItemIds, statesById]);

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
  const gapFillExercises = useExercisesWithAnswers(gapFillStages.map((s) => s.exerciseId));
  const compExercises = useExercisesWithAnswers(compStages.map((s) => s.exerciseId));

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

  const spansByParagraph = useMemo(() => {
    const byIndex = new Map<number, LessonTextSpan[]>();
    for (const span of spansQuery.data ?? []) {
      const list = byIndex.get(span.paragraphIndex);
      if (list) list.push(span);
      else byIndex.set(span.paragraphIndex, [span]);
    }
    return byIndex;
  }, [spansQuery.data]);

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
    <div>
      {heroImage && (
        <div className="mb-6.5 h-50 overflow-hidden rounded-[20px] bg-(--ssz-bg-subtle)">
          {heroAsset.data?.url && (
            // eslint-disable-next-line @next/next/no-img-element -- author-uploaded lesson asset
            <img src={heroAsset.data.url} alt={heroImage.alt} className="h-full w-full object-cover" />
          )}
        </div>
      )}

      <div className="mb-4.5">
        <div className="mb-1.5 text-[11px] font-bold tracking-wider text-(--ssz-color-primary-600) uppercase">
          {t('eyebrow', { unit: unitPosition, course: courseTitle, type: tContent('materialType.text') })}
        </div>
        <h1 className="font-reading mb-1.5 text-[29px] leading-[1.15] font-semibold tracking-tight text-(--ssz-text-primary)">
          {variant.data.displayTitle || lesson.data.title}
        </h1>
        {variant.data.displayDescription && (
          <p className="text-sm text-(--ssz-text-muted) italic">{variant.data.displayDescription}</p>
        )}
      </div>

      <div className="mb-5.5 flex flex-wrap items-center gap-3.5">
        <ModeToggle mode={effectiveMode} modes={availableModes} onChange={setMode} />
        {hasGlossing && <GlossToggle visibility={glossVisibility} onChange={setGlossVisibility} />}
        {glossary.size > 0 && glossVisibility !== 'off' && (
          <span className="flex items-center gap-1.5 text-xs text-(--ssz-text-muted)">
            <span
              className="inline-block w-6.5 align-middle border-b-[1.5px] border-dotted border-(--ssz-color-primary-500)"
              aria-hidden="true"
            />
            {t('tapToLookUp')}
          </span>
        )}
        {coveragePercent !== null && (
          <span className="text-xs text-(--ssz-text-muted)">{t('coverage', { percent: coveragePercent })}</span>
        )}
      </div>

      {narration && (
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
        </GlossIntensityProvider>
      )}

      <TextComprehensionCheck gapFillItems={gapFillItems} compItems={compItems} />
    </div>
  );
}
